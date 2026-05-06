/**
 * PlanktonLayer
 */
export class PlanktonLayer {
    constructor(gl, config = {}) {
        this.gl = gl;
        this.program = null;
        this.microProgram = null;
        this.buffers = {};
        this.microBuffers = {};
        this.particles = [];
        this.microParticles = [];
        this.qualityMultiplier = 1.0;
        this._lastOpacity = null;
        
        this.config = {
            swarmCount: 30,
            particlesPerSwarm: 50,
            fineCount: 1500,
            microCount: 500,
            ...config
        };
    }
    
    init(width, height) {
        this.width = width;
        this.height = height;
        this.initParticles(width, height);
        this.initMicroParticles();
        this.compileShaders();
        this.compileMicroShaders();
        this.createBuffers();
        this.createMicroBuffers();
    }
    
    initParticles(width, height) {
        this.particles = [];
        
        for (let s = 0; s < this.config.swarmCount; s++) {
            const centerX = Math.random();
            const centerY = Math.pow(Math.random(), 2) * 0.7 + 0.05;
            
            // Těsná hejna — spread se NEZVĚTŠUJE s hloubkou
            const swarmSpreadX = 0.02 + Math.random() * 0.03;
            const swarmSpreadY = 0.015 + Math.random() * 0.02;
            
            for (let i = 0; i < this.config.particlesPerSwarm; i++) {
                const spreadX = (Math.random() - 0.5) * swarmSpreadX;
                const spreadY = (Math.random() - 0.5) * swarmSpreadY;
                const yPos = Math.min(0.9, Math.max(0.05, centerY + spreadY));
                
                this.particles.push({
                    x: Math.min(1, Math.max(0, centerX + spreadX)),
                    y: yPos,
                    size: Math.random() < 0.7 ? 1 : (Math.random() < 0.8 ? 2 : 3),
                    driftX: (Math.random() * 16 - 8),
                    duration: (Math.random() * 12) + 4,
                    phase: Math.random() * Math.PI * 2,
                    opacity: 0.25 + Math.random() * 0.45,
                    green: 170 + Math.floor(Math.random() * 85),
                    glimmerIntensity: yPos < 0.3 ? (0.3 - yPos) / 0.3 : 0,
                    glimmerOffset: Math.random() * Math.PI * 2,
                    glimmerSpeed: 0.4 + Math.random() * 0.8
                });
            }
        }
        
        for (let i = 0; i < this.config.fineCount; i++) {
            const yPos = Math.pow(Math.random(), 2) * 0.9 + 0.05;
            
            this.particles.push({
                x: Math.random(),
                y: yPos,
                size: Math.random() < 0.9 ? 1 : 2,
                driftX: (Math.random() * 18 - 9),
                duration: 6 + Math.random() * 28,
                phase: Math.random() * Math.PI * 2,
                opacity: 0.05 + Math.random() * 0.2,
                green: 170 + Math.floor(Math.random() * 70),
                glimmerIntensity: yPos < 0.3 ? (0.3 - yPos) / 0.3 : 0,
                glimmerOffset: Math.random() * Math.PI * 2,
                glimmerSpeed: 0.4 + Math.random() * 0.8
            });
        }
    }
    
    initMicroParticles() {
        this.microParticles = [];
        for (let i = 0; i < this.config.microCount; i++) {
            this.microParticles.push({
                x: Math.random(),
                baseY: Math.random(),           // 0–1, startovní výška
                speed: 3 + Math.random() * 8,   // px/s stoupání
                phase: Math.random() * Math.PI * 2,
                opacity: 0.06 + Math.random() * 0.12
            });
        }
    }
    
    compileMicroShaders() {
        const vertSrc = `#version 300 es
            in float a_x;
            in float a_baseY;
            in float a_speed;
            in float a_phase;

            uniform vec2 u_resolution;
            uniform float u_time;

            out float v_fade;

            void main() {
                // Stoupání nahoru s wrapem
                float yPx = a_baseY * u_resolution.y;
                float risen = mod(u_time * a_speed * 0.001, u_resolution.y);
                float y = mod(yPx - risen + u_resolution.y, u_resolution.y);

                // Jemné vodorovné vlnění
                float x = a_x * u_resolution.x + sin(u_time * 0.0004 * a_speed + a_phase) * 6.0;

                // Fade u vrcholu a dna
                float normY = y / u_resolution.y;
                v_fade = smoothstep(0.0, 0.07, normY) * smoothstep(1.0, 0.88, normY);

                vec2 clip = (vec2(x, y) / u_resolution) * 2.0 - 1.0;
                clip.y = -clip.y;
                gl_Position = vec4(clip, 0.0, 1.0);
                gl_PointSize = 1.0;
            }
        `;

        const fragSrc = `#version 300 es
            precision mediump float;
            uniform float u_baseOpacity;
            in float v_fade;
            out vec4 outColor;
            void main() {
                outColor = vec4(0.52, 0.82, 0.94, u_baseOpacity * v_fade);
            }
        `;

        this.microProgram = this.createProgram(vertSrc, fragSrc);
        if (this.microProgram) {
            const gl = this.gl;
            const p = this.microProgram;
            this.microLocs = {
                resolution:  gl.getUniformLocation(p, 'u_resolution'),
                time:        gl.getUniformLocation(p, 'u_time'),
                baseOpacity: gl.getUniformLocation(p, 'u_baseOpacity'),
                x:           gl.getAttribLocation(p, 'a_x'),
                baseY:       gl.getAttribLocation(p, 'a_baseY'),
                speed:       gl.getAttribLocation(p, 'a_speed'),
                phase:       gl.getAttribLocation(p, 'a_phase'),
            };
        }
    }
    
    createMicroBuffers() {
        const gl = this.gl;
        const n = this.microParticles.length;
        const xs      = new Float32Array(n);
        const baseYs  = new Float32Array(n);
        const speeds  = new Float32Array(n);
        const phases  = new Float32Array(n);

        for (let i = 0; i < n; i++) {
            const p = this.microParticles[i];
            xs[i]     = p.x;
            baseYs[i] = p.baseY;
            speeds[i] = p.speed;
            phases[i] = p.phase;
        }

        const upload = (data) => {
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
            return buf;
        };

        this.microBuffers.x     = upload(xs);
        this.microBuffers.baseY = upload(baseYs);
        this.microBuffers.speed = upload(speeds);
        this.microBuffers.phase = upload(phases);

        // VAO for micro program
        this.microVao = gl.createVertexArray();
        gl.bindVertexArray(this.microVao);
        const ml = this.microLocs;
        const bindM = (loc, buf) => {
            gl.enableVertexAttribArray(loc);
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 0, 0);
        };
        bindM(ml.x,     this.microBuffers.x);
        bindM(ml.baseY, this.microBuffers.baseY);
        bindM(ml.speed, this.microBuffers.speed);
        bindM(ml.phase, this.microBuffers.phase);
        gl.bindVertexArray(null);
    }
    
    renderMicro(currentTime) {
        const gl = this.gl;
        if (!this.microProgram) return;

        gl.useProgram(this.microProgram);
        const l = this.microLocs;

        gl.uniform2f(l.resolution, this.width, this.height);
        gl.uniform1f(l.time, currentTime);
        gl.uniform1f(l.baseOpacity, 0.55 * this.qualityMultiplier);

        gl.bindVertexArray(this.microVao);
        const count = Math.floor(this.microParticles.length * this.qualityMultiplier);
        gl.drawArrays(gl.POINTS, 0, count);
    }

    compileShaders() {
        const gl = this.gl;
        
        const vertexShaderSource = `#version 300 es
            in vec2 a_basePosition;
            in float a_size;
            in float a_driftX;
            in float a_duration;
            in float a_phase;
            in float a_glimmerIntensity;
            in float a_glimmerOffset;
            in float a_glimmerSpeed;
            
            uniform vec2 u_resolution;
            uniform float u_time;
            
            out float v_glimmer;
            
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
                
                // Bioluminiscence: ostrý záblesk (mocnina sinus → vzácné hroty)
                float raw = sin(u_time * 0.0002 * a_glimmerSpeed + a_glimmerOffset);
                float glimmer = pow(max(0.0, raw), 16.0) * a_glimmerIntensity;
                v_glimmer = glimmer;
                
                gl_Position = vec4(clipSpace, 0.0, 1.0);
                gl_PointSize = a_size + glimmer * 1.5;
            }
        `;
        
        const fragmentShaderSource = `#version 300 es
            precision highp float;
            
            uniform vec3 u_color;
            uniform float u_opacity;
            
            in float v_glimmer;
            out vec4 outColor;
            
            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                
                if (dist > 0.5) {
                    discard;
                }
                
                // Jádro bodu
                float core = smoothstep(0.5, 0.15, dist);
                // Měkké halo / glow kolem jádra
                float halo = smoothstep(0.5, 0.0, dist) * 0.35;
                float alpha = core + halo;
                
                // Bioluminiscence: posun barvy k modrobílé + zesilení jasu
                vec3 glowColor = mix(u_color, vec3(0.65, 0.95, 1.0), v_glimmer);
                float finalOpacity = min(1.0, u_opacity * alpha * (1.0 + v_glimmer * 4.0));
                
                outColor = vec4(glowColor, finalOpacity);
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
                glimmerIntensity: gl.getAttribLocation(p, 'a_glimmerIntensity'),
                glimmerOffset: gl.getAttribLocation(p, 'a_glimmerOffset'),
                glimmerSpeed: gl.getAttribLocation(p, 'a_glimmerSpeed'),
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
        
        const glimmerIntensities = new Float32Array(this.particles.length);
        const glimmerOffsets = new Float32Array(this.particles.length);
        const glimmerSpeeds = new Float32Array(this.particles.length);
        
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            glimmerIntensities[i] = p.glimmerIntensity;
            glimmerOffsets[i] = p.glimmerOffset;
            glimmerSpeeds[i] = p.glimmerSpeed;
        }
        
        // Upload all static data into GPU buffers
        const upload = (data) => {
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
            return buf;
        };
        this.buffers.position        = upload(positions);
        this.buffers.size            = upload(sizes);
        this.buffers.drift           = upload(drifts);
        this.buffers.duration        = upload(durations);
        this.buffers.phase           = upload(phases);
        this.buffers.glimmerIntensity = upload(glimmerIntensities);
        this.buffers.glimmerOffset   = upload(glimmerOffsets);
        this.buffers.glimmerSpeed    = upload(glimmerSpeeds);

        // VAO: record attribute layout once — render() just calls bindVertexArray
        this.vao = gl.createVertexArray();
        gl.bindVertexArray(this.vao);
        const l = this.locs;
        const bindAttr = (loc, buf, size) => {
            gl.enableVertexAttribArray(loc);
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
        };
        bindAttr(l.basePosition,     this.buffers.position,         2);
        bindAttr(l.size,             this.buffers.size,             1);
        bindAttr(l.driftX,           this.buffers.drift,            1);
        bindAttr(l.duration,         this.buffers.duration,         1);
        bindAttr(l.phase,            this.buffers.phase,            1);
        bindAttr(l.glimmerIntensity, this.buffers.glimmerIntensity, 1);
        bindAttr(l.glimmerOffset,    this.buffers.glimmerOffset,    1);
        bindAttr(l.glimmerSpeed,     this.buffers.glimmerSpeed,     1);
        gl.bindVertexArray(null);
    }
    
    render(currentTime, deltaTime) {
        const gl = this.gl;
        const program = this.program;
        
        if (!program || this.particles.length === 0) return;
        
        gl.useProgram(program);
        const locs = this.locs;
        gl.uniform2f(locs.resolution, this.width, this.height);
        gl.uniform1f(locs.time, currentTime);
        gl.uniform3f(locs.color, 0.45, 0.78, 0.95);  // světle modrá
        // Upload opacity only when the value changes (qualityMultiplier rarely changes)
        const opacity = 0.45 * this.qualityMultiplier;
        if (this._lastOpacity !== opacity) {
            gl.uniform1f(locs.opacity, opacity);
            this._lastOpacity = opacity;
        }

        gl.bindVertexArray(this.vao);
        const particleCount = Math.floor(this.particles.length * this.qualityMultiplier);
        gl.drawArrays(gl.POINTS, 0, particleCount);

        this.renderMicro(currentTime);
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
        if (this.microProgram) gl.deleteProgram(this.microProgram);
        if (this.vao) gl.deleteVertexArray(this.vao);
        if (this.microVao) gl.deleteVertexArray(this.microVao);
        for (const key in this.buffers) gl.deleteBuffer(this.buffers[key]);
        for (const key in this.microBuffers) gl.deleteBuffer(this.microBuffers[key]);
    }
}
