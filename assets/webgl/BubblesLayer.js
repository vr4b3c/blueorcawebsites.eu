/**
 * BubblesLayer
 */
export class BubblesLayer {
    constructor(gl, config = {}) {
        this.gl = gl;
        this.program = null;
        this.buffers = {};
        this.bubbles = [];
        this.sources = [];
        this.qualityMultiplier = 1.0;
        
        this.config = {
            sourceWidthBase: 400,
            minSourceSpacing: 80,
            minSize: 4,
            maxSize: 10,
            riseSpeed: 0.3,
            swayAmount: 10,
            bubblesPerSource: 0.02,
            ...config
        };
    }
    
    init(width, height) {
        this.width = width;
        this.height = height;
        this.initSources(width, height);
        this.compileShaders();
        this.createBuffers();
    }
    
    initSources(width, height) {
        this.sources = [];
        
        const baseSourceCount = Math.max(1, Math.floor(width / this.config.sourceWidthBase));
        const targetSourceCount = Math.max(1, baseSourceCount);
        
        for (let attempt = 0; attempt < targetSourceCount * 10 && this.sources.length < targetSourceCount; attempt++) {
            const x = Math.random() * width;
            
            let tooClose = false;
            for (const source of this.sources) {
                if (Math.abs(source.x - x) < this.config.minSourceSpacing) {
                    tooClose = true;
                    break;
                }
            }
            
            if (!tooClose) {
                this.sources.push({ x, y: height + 5 });
            }
        }
    }
    
    compileShaders() {
        const gl = this.gl;
        
        const vertexShaderSource = `#version 300 es
            in vec2 a_position;
            in float a_size;
            in float a_age;
            in float a_swayPeriod;
            in float a_startX;
            
            uniform vec2 u_resolution;
            uniform float u_time;
            uniform float u_swayAmount;
            
            out float v_age;
            out float v_size;
            
            void main() {
                float swayProgress = mod(a_age / a_swayPeriod, 1.0);
                float swayOffset = sin(swayProgress * 6.28318530718) * u_swayAmount;
                
                vec2 position = a_position;
                position.x = a_startX + swayOffset;
                
                vec2 clipSpace = (position / u_resolution) * 2.0 - 1.0;
                clipSpace.y = -clipSpace.y;
                
                gl_Position = vec4(clipSpace, 0.0, 1.0);
                gl_PointSize = a_size;
                
                v_age = a_age;
                v_size = a_size;
            }
        `;
        
        const fragmentShaderSource = `#version 300 es
            precision highp float;
            
            in float v_age;
            in float v_size;
            
            out vec4 outColor;
            
            void main() {
                vec2 coord = gl_PointCoord - 0.5;
                float dist = length(coord);
                
                if (dist > 0.5) discard;
                
                float gradient = 1.0 - dist * 2.0;
                vec3 color = mix(vec3(0.588, 0.784, 1.0), vec3(1.0), gradient);
                float alpha = gradient * 0.6;
                
                outColor = vec4(color, alpha);
            }
        `;
        
        this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
        if (this.program) {
            const gl = this.gl;
            const p = this.program;
            this.locs = {
                resolution: gl.getUniformLocation(p, 'u_resolution'),
                swayAmount: gl.getUniformLocation(p, 'u_swayAmount'),
                position: gl.getAttribLocation(p, 'a_position'),
                size: gl.getAttribLocation(p, 'a_size'),
                age: gl.getAttribLocation(p, 'a_age'),
                swayPeriod: gl.getAttribLocation(p, 'a_swayPeriod'),
                startX: gl.getAttribLocation(p, 'a_startX'),
            };
        }
    }
    
    createProgram(vertexSource, fragmentSource) {
        const gl = this.gl;
        
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            console.error('Vertex shader error:', gl.getShaderInfoLog(vertexShader));
            return null;
        }
        
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);
        
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            console.error('Fragment shader error:', gl.getShaderInfoLog(fragmentShader));
            return null;
        }
        
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return null;
        }
        
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        
        return program;
    }
    
    createBuffers() {
        const gl = this.gl;
        // Pre-allocate GPU buffers at max capacity — avoids repeated reallocation
        this.MAX_BUBBLES = 200;
        const maxN = this.MAX_BUBBLES;
        // CPU-side reusable typed arrays — no GC pressure per frame
        this._cpu = {
            positions:   new Float32Array(maxN * 2),
            sizes:       new Float32Array(maxN),
            ages:        new Float32Array(maxN),
            swayPeriods: new Float32Array(maxN),
            startXs:     new Float32Array(maxN),
        };
        const allocGPU = (byteSize) => {
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, byteSize, gl.DYNAMIC_DRAW);
            return buf;
        };
        this.buffers.position  = allocGPU(maxN * 2 * 4);
        this.buffers.size      = allocGPU(maxN * 4);
        this.buffers.age       = allocGPU(maxN * 4);
        this.buffers.swayPeriod = allocGPU(maxN * 4);
        this.buffers.startX    = allocGPU(maxN * 4);

        // VAO records attribute layout once — render() only calls bindVertexArray + draw
        // (bufferSubData still updates data each frame, but the pointer setup is free)
        const locs = this.locs;
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);
        const bindAttr = (loc, buf, size) => {
            if (loc < 0) return;
            gl.enableVertexAttribArray(loc);
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
        };
        bindAttr(locs.position,   this.buffers.position,   2);
        bindAttr(locs.size,       this.buffers.size,       1);
        bindAttr(locs.age,        this.buffers.age,        1);
        bindAttr(locs.swayPeriod, this.buffers.swayPeriod, 1);
        bindAttr(locs.startX,     this.buffers.startX,     1);
        gl.bindVertexArray(null);
    }
    
    render(currentTime, deltaTime) {
        const gl = this.gl;
        const program = this.program;
        
        if (!program) return;
        
        const spawnChance = this.config.bubblesPerSource * this.qualityMultiplier;
        for (const source of this.sources) {
            if (Math.random() < spawnChance) {
                this.spawnBubble(source);
            }
        }
        
        // In-place update and compaction — no Array.filter() allocation per frame
        const dt = Math.min(deltaTime, 50);
        let bWrite = 0;
        for (let bi = 0; bi < this.bubbles.length; bi++) {
            const bubble = this.bubbles[bi];
            bubble.y -= bubble.riseSpeed * this.config.riseSpeed;
            bubble.age += dt;
            
            const riseProgress = 1 - (bubble.y / this.height);
            bubble.size = bubble.baseSize * (1 - riseProgress * 0.6);
            
            if (bubble.y + bubble.size >= 0) {
                this.bubbles[bWrite++] = bubble;
            }
        }
        this.bubbles.length = bWrite;
        
        const n = Math.min(this.bubbles.length, this.MAX_BUBBLES);
        if (n === 0) return;

        // Fill pre-allocated CPU arrays — zero allocation, no GC
        const cpu = this._cpu;
        for (let i = 0; i < n; i++) {
            const b = this.bubbles[i];
            cpu.positions[i * 2]     = b.startX;
            cpu.positions[i * 2 + 1] = b.y;
            cpu.sizes[i]       = b.size;
            cpu.ages[i]        = b.age;
            cpu.swayPeriods[i] = b.swayPeriod;
            cpu.startXs[i]     = b.startX;
        }

        gl.useProgram(program);
        const locs = this.locs;
        gl.uniform2f(locs.resolution, this.width, this.height);
        gl.uniform1f(locs.swayAmount, this.config.swayAmount);

        // Upload only the live portion using bufferSubData (GPU buffer stays same size)
        const sub = (buf, data, count, stride) => {
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, count * stride));
        };
        sub(this.buffers.position,   cpu.positions,   n, 2);
        sub(this.buffers.size,       cpu.sizes,       n, 1);
        sub(this.buffers.age,        cpu.ages,        n, 1);
        sub(this.buffers.swayPeriod, cpu.swayPeriods, n, 1);
        sub(this.buffers.startX,     cpu.startXs,     n, 1);

        // VAO holds all attribute pointers — no per-frame enableVertexAttribArray calls
        gl.bindVertexArray(this.vao);
        gl.drawArrays(gl.POINTS, 0, n);
        gl.bindVertexArray(null);
    }
    
    spawnBubble(source) {
        const baseSize = this.config.minSize + Math.random() * (this.config.maxSize - this.config.minSize);
        const offsetX = (Math.random() - 0.5) * 20;
        
        this.bubbles.push({
            startX: source.x + offsetX,
            y: source.y,
            baseSize,
            size: baseSize,
            riseSpeed: 0.5 + Math.random() * 1.5,
            swayPeriod: 2000 + Math.random() * 3000,
            age: Math.random() * 1000
        });
    }
    
    setQuality(quality) {
        this.qualityMultiplier = quality;
    }

    toggle(enabled) {
        this.enabled = !!enabled;
        if (this.enabled && !this.program) {
            if (this.width && this.height) {
                this.init(this.width, this.height);
            }
        }
    }
    
    onResize(width, height) {
        this.width = width;
        this.height = height;
        this.initSources(width, height);
    }
    
    destroy() {
        const gl = this.gl;
        if (this.program) gl.deleteProgram(this.program);
        if (this.vao) gl.deleteVertexArray(this.vao);
        for (const key in this.buffers) {
            gl.deleteBuffer(this.buffers[key]);
        }
    }
}
