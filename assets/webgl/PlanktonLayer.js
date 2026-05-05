/**
 * PlanktonLayer
 */
export class PlanktonLayer {
    constructor(gl) {
        this.gl = gl;
        this.program = null;
        this.buffers = {};
        this.particles = [];
        this.qualityMultiplier = 1.0;
        
        this.config = {
            swarmCount: 30,
            particlesPerSwarm: 50,
            fineCount: 1500
        };
    }
    
    init(width, height) {
        this.width = width;
        this.height = height;
        this.initParticles(width, height);
        this.compileShaders();
        this.createBuffers();
    }
    
    initParticles(width, height) {
        this.particles = [];
        
        for (let s = 0; s < this.config.swarmCount; s++) {
            const centerX = Math.random();
            const centerY = Math.pow(Math.random(), 2) * 0.7 + 0.05;
            
            const depthFactor = centerY / 0.75;
            const swarmSpreadX = (0.03 + Math.random() * 0.06) * (1 + depthFactor * 2);
            const swarmSpreadY = (0.02 + Math.random() * 0.04) * (1 + depthFactor * 2);
            
            for (let i = 0; i < this.config.particlesPerSwarm; i++) {
                const spreadX = (Math.random() - 0.5) * swarmSpreadX;
                const spreadY = (Math.random() - 0.5) * swarmSpreadY;
                const yPos = Math.min(0.9, Math.max(0.05, centerY + spreadY));
                
                this.particles.push({
                    x: Math.min(1, Math.max(0, centerX + spreadX)),
                    y: yPos,
                    size: Math.random() < 0.7 ? 1 : (Math.random() < 0.8 ? 2 : 3),
                    driftX: (Math.random() * 60 - 30),
                    duration: (Math.random() * 12) + 4,
                    phase: Math.random() * Math.PI * 2,
                    opacity: 0.15 + Math.random() * 0.45,
                    green: 170 + Math.floor(Math.random() * 85),
                    glimmerIntensity: yPos < 0.3 ? (0.3 - yPos) / 0.3 : 0,
                    glimmerOffset: Math.random() * Math.PI * 2,
                    glimmerSpeed: 2 + Math.random() * 4
                });
            }
        }
        
        for (let i = 0; i < this.config.fineCount; i++) {
            const yPos = Math.pow(Math.random(), 2) * 0.9 + 0.05;
            
            this.particles.push({
                x: Math.random(),
                y: yPos,
                size: Math.random() < 0.9 ? 1 : 2,
                driftX: (Math.random() * 70 - 35),
                duration: 6 + Math.random() * 28,
                phase: Math.random() * Math.PI * 2,
                opacity: 0.05 + Math.random() * 0.2,
                green: 170 + Math.floor(Math.random() * 70),
                glimmerIntensity: yPos < 0.3 ? (0.3 - yPos) / 0.3 : 0,
                glimmerOffset: Math.random() * Math.PI * 2,
                glimmerSpeed: 2 + Math.random() * 4
            });
        }
    }
    
    compileShaders() {
        const gl = this.gl;
        
        const vertexShaderSource = `#version 300 es
            in vec2 a_basePosition;
            in float a_size;
            in float a_driftX;
            in float a_duration;
            in float a_phase;
            
            uniform vec2 u_resolution;
            uniform float u_time;
            
            out float v_opacity;
            
            void main() {
                float progress = mod(u_time / (a_duration * 1000.0), 1.0);
                float angle = progress * 6.28318530718 + a_phase;
                
                float yOffset = sin(angle) * 3.0;
                float driftOffset = sin(angle) * a_driftX;
                
                vec2 position;
                position.x = a_basePosition.x * u_resolution.x + driftOffset;
                position.y = a_basePosition.y * u_resolution.y + yOffset;
                
                vec2 clipSpace = (position / u_resolution) * 2.0 - 1.0;
                clipSpace.y = -clipSpace.y;
                
                gl_Position = vec4(clipSpace, 0.0, 1.0);
                gl_PointSize = a_size;
            }
        `;
        
        const fragmentShaderSource = `#version 300 es
            precision highp float;
            
            uniform vec3 u_color;
            uniform float u_opacity;
            
            out vec4 outColor;
            
            void main() {
                // Vytvoř kruhový tvar místo čtverce
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                
                // Zahoď pixely mimo kruh
                if (dist > 0.5) {
                    discard;
                }
                
                // Jemné vyhlazení okrajů
                float alpha = smoothstep(0.5, 0.3, dist);
                
                outColor = vec4(u_color, u_opacity * alpha);
            }
        `;
        
        this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
        if (this.program) {
            const gl = this.gl;
            const p = this.program;
            this.locs = {
                resolution: gl.getUniformLocation(p, 'u_resolution'),
                time: gl.getUniformLocation(p, 'u_time'),
                color: gl.getUniformLocation(p, 'u_color'),
                opacity: gl.getUniformLocation(p, 'u_opacity'),
                basePosition: gl.getAttribLocation(p, 'a_basePosition'),
                size: gl.getAttribLocation(p, 'a_size'),
                driftX: gl.getAttribLocation(p, 'a_driftX'),
                duration: gl.getAttribLocation(p, 'a_duration'),
                phase: gl.getAttribLocation(p, 'a_phase'),
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
        
        const positions = new Float32Array(this.particles.length * 2);
        const sizes = new Float32Array(this.particles.length);
        const drifts = new Float32Array(this.particles.length);
        const durations = new Float32Array(this.particles.length);
        const phases = new Float32Array(this.particles.length);
        
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            positions[i * 2] = p.x;
            positions[i * 2 + 1] = p.y;
            sizes[i] = p.size;
            drifts[i] = p.driftX;
            durations[i] = p.duration;
            phases[i] = p.phase;
        }
        
        this.buffers.position = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        
        this.buffers.size = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.size);
        gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);
        
        this.buffers.drift = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.drift);
        gl.bufferData(gl.ARRAY_BUFFER, drifts, gl.STATIC_DRAW);
        
        this.buffers.duration = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.duration);
        gl.bufferData(gl.ARRAY_BUFFER, durations, gl.STATIC_DRAW);
        
        this.buffers.phase = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.phase);
        gl.bufferData(gl.ARRAY_BUFFER, phases, gl.STATIC_DRAW);
    }
    
    render(currentTime, deltaTime) {
        const gl = this.gl;
        const program = this.program;
        
        if (!program || this.particles.length === 0) return;
        
        gl.useProgram(program);
        
        const locs = this.locs;
        gl.uniform2f(locs.resolution, this.width, this.height);
        gl.uniform1f(locs.time, currentTime);
        gl.uniform3f(locs.color, 75/255, 200/255, 120/255);
        gl.uniform1f(locs.opacity, 0.7 * this.qualityMultiplier);
        
        gl.enableVertexAttribArray(locs.basePosition);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.vertexAttribPointer(locs.basePosition, 2, gl.FLOAT, false, 0, 0);
        
        gl.enableVertexAttribArray(locs.size);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.size);
        gl.vertexAttribPointer(locs.size, 1, gl.FLOAT, false, 0, 0);
        
        gl.enableVertexAttribArray(locs.driftX);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.drift);
        gl.vertexAttribPointer(locs.driftX, 1, gl.FLOAT, false, 0, 0);
        
        gl.enableVertexAttribArray(locs.duration);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.duration);
        gl.vertexAttribPointer(locs.duration, 1, gl.FLOAT, false, 0, 0);
        
        gl.enableVertexAttribArray(locs.phase);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.phase);
        gl.vertexAttribPointer(locs.phase, 1, gl.FLOAT, false, 0, 0);
        
        const particleCount = Math.floor(this.particles.length * this.qualityMultiplier);
        gl.drawArrays(gl.POINTS, 0, particleCount);
    }
    
    setQuality(quality) {
        this.qualityMultiplier = quality;
    }
    
    onResize(width, height) {
        this.width = width;
        this.height = height;
    }

    toggle(enabled) {
        this.enabled = !!enabled;
        if (this.enabled && !this.program) {
            if (this.width && this.height) {
                this.init(this.width, this.height);
            }
        }
    }
    
    destroy() {
        const gl = this.gl;
        if (this.program) gl.deleteProgram(this.program);
        for (const key in this.buffers) {
            gl.deleteBuffer(this.buffers[key]);
        }
    }
}
