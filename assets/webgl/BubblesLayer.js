/**
 * BubblesLayer
 */
export class BubblesLayer {
    constructor(gl) {
        this.gl = gl;
        this.program = null;
        this.buffers = {};
        this.bubbles = [];
        this.sources = [];
        this.qualityMultiplier = 1.0;
        
        this.config = {
            sourceWidthBase: 400,
            minSourceSpacing: 80,
            minSize: 2,
            maxSize: 5,
            riseSpeed: 0.3,
            swayAmount: 10,
            bubblesPerSource: 0.02
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
        
        this.buffers.position = gl.createBuffer();
        this.buffers.size = gl.createBuffer();
        this.buffers.age = gl.createBuffer();
        this.buffers.swayPeriod = gl.createBuffer();
        this.buffers.startX = gl.createBuffer();
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
        
        const dt = Math.min(deltaTime, 50);
        this.bubbles = this.bubbles.filter(bubble => {
            bubble.y -= bubble.riseSpeed * this.config.riseSpeed;
            bubble.age += dt;
            
            const riseProgress = 1 - (bubble.y / this.height);
            bubble.size = bubble.baseSize * (1 - riseProgress * 0.6);
            
            return bubble.y + bubble.size >= 0;
        });
        
        if (this.bubbles.length === 0) return;
        
        const positions = new Float32Array(this.bubbles.length * 2);
        const sizes = new Float32Array(this.bubbles.length);
        const ages = new Float32Array(this.bubbles.length);
        const swayPeriods = new Float32Array(this.bubbles.length);
        const startXs = new Float32Array(this.bubbles.length);
        
        for (let i = 0; i < this.bubbles.length; i++) {
            const b = this.bubbles[i];
            positions[i * 2] = b.startX;
            positions[i * 2 + 1] = b.y;
            sizes[i] = b.size;
            ages[i] = b.age;
            swayPeriods[i] = b.swayPeriod;
            startXs[i] = b.startX;
        }
        
        gl.useProgram(program);
        
        const locs = this.locs;
        gl.uniform2f(locs.resolution, this.width, this.height);
        gl.uniform1f(locs.swayAmount, this.config.swayAmount);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(locs.position);
        gl.vertexAttribPointer(locs.position, 2, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.size);
        gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(locs.size);
        gl.vertexAttribPointer(locs.size, 1, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.age);
        gl.bufferData(gl.ARRAY_BUFFER, ages, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(locs.age);
        gl.vertexAttribPointer(locs.age, 1, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.swayPeriod);
        gl.bufferData(gl.ARRAY_BUFFER, swayPeriods, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(locs.swayPeriod);
        gl.vertexAttribPointer(locs.swayPeriod, 1, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.startX);
        gl.bufferData(gl.ARRAY_BUFFER, startXs, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(locs.startX);
        gl.vertexAttribPointer(locs.startX, 1, gl.FLOAT, false, 0, 0);
        
        gl.drawArrays(gl.POINTS, 0, this.bubbles.length);
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
        for (const key in this.buffers) {
            gl.deleteBuffer(this.buffers[key]);
        }
    }
}
