/**
 * LightRaysLayer
 */
export class LightRaysLayer {
    constructor(gl) {
        this.gl = gl;
        this.program = null;
        this.buffers = {};
        this.rays = [];
        // Sub-layer toggles
        this.rayBeamsEnabled = true;
        this.sunGlowEnabled = true;
    }

    init(width, height) {
        this.width = width;
        this.height = height;
        this.initRays(width);
        this.compileShaders();
        this.createBuffers();
    }

    initRays(width) {
        this.rays = [];
        const rayCount = 5;
        const spacing = width / (rayCount + 1);

        for (let i = 0; i < rayCount; i++) {
            this.rays.push({
                x: spacing * (i + 1),
                offset: Math.random() * Math.PI * 2,
                speed: 0.8 + Math.random() * 0.4
            });
        }
    }

    compileShaders() {
        const gl = this.gl;

        const vertexShaderSource = `#version 300 es
            in vec2 a_position;
            out vec2 v_uv;
            
            void main() {
                v_uv = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        const fragmentShaderSource = `#version 300 es
            precision highp float;
            
            in vec2 v_uv;
            out vec4 outColor;
            
            uniform vec2 u_resolution;
            uniform float u_time;
            uniform float u_ray1; // x position
            uniform float u_ray2;
            uniform float u_ray3;
            uniform float u_ray4;
            uniform float u_ray5;
            uniform float u_sway1; // sway amount
            uniform float u_sway2;
            uniform float u_sway3;
            uniform float u_sway4;
            uniform float u_sway5;
            uniform int u_rayBeamsEnabled;
            uniform int u_sunGlowEnabled;
            
            float rayIntensity(float x, float rayX, float sway) {
                float topX = rayX + sway * v_uv.y;
                float dist = abs(x - topX);
                float rayWidth = 40.0;
                float intensity = 1.0 - smoothstep(0.0, rayWidth / 2.0, dist);
                return intensity;
            }
            
            void main() {
                float x = v_uv.x * u_resolution.x;
                float y = v_uv.y;
                
                vec4 color = vec4(0.0);
                vec3 warmLight = vec3(1.0, 1.0, 0.863);  // Teplé světlo pro rays
                vec3 coolLight = vec3(0.122, 0.490, 0.647); // Střední modrá z palety (#1f7da5) pro glow
                
                // Ray beams (kužely)
                if (u_rayBeamsEnabled == 1) {
                    float totalIntensity = 0.0;
                    totalIntensity += rayIntensity(x, u_ray1, u_sway1);
                    totalIntensity += rayIntensity(x, u_ray2, u_sway2);
                    totalIntensity += rayIntensity(x, u_ray3, u_sway3);
                    totalIntensity += rayIntensity(x, u_ray4, u_sway4);
                    totalIntensity += rayIntensity(x, u_ray5, u_sway5);
                    
                    float verticalFade = y; // Silnější nahoře (y=1), slabší dole (y=0)
                    float rayAlpha = totalIntensity * 0.08 * verticalFade;
                    color.rgb += warmLight * rayAlpha;
                    color.a += rayAlpha;
                }
                
                // Sun glow (radiální záře)
                if (u_sunGlowEnabled == 1) {
                    vec2 center = vec2(0.5, 1.0);
                    vec2 diff = v_uv - center;
                    float dist = length(diff);
                    
                    // Silnější pulsování
                    float pulse = 0.75 + sin(u_time * 0.0005) * 0.25;
                    
                    // Hladší gradient s více kroky pro odstranění pruhů
                    float glowRadius = 0.9;
                    float glow = smoothstep(glowRadius, 0.0, dist);
                    glow = smoothstep(0.0, 1.0, glow); // Dvojité smoothstep pro extra vyhlazení
                    glow = pow(glow, 1.8);
                    
                    // Vertikální fade
                    float verticalFade = smoothstep(0.0, 0.7, y);
                    
                    // Prolínání
                    float glowStrength = glow * pulse * verticalFade;
                    color.rgb += coolLight * glowStrength * 0.6;
                    color.a += glowStrength * 0.4;
                }
                
                outColor = color;
            }
        `;

        this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
        if (this.program) {
            const gl = this.gl;
            const p = this.program;
            this.locs = {
                resolution: gl.getUniformLocation(p, 'u_resolution'),
                time: gl.getUniformLocation(p, 'u_time'),
                rayBeamsEnabled: gl.getUniformLocation(p, 'u_rayBeamsEnabled'),
                sunGlowEnabled: gl.getUniformLocation(p, 'u_sunGlowEnabled'),
                position: gl.getAttribLocation(p, 'a_position'),
                rays: this.rays.map((_, i) => gl.getUniformLocation(p, `u_ray${i + 1}`)),
                sways: this.rays.map((_, i) => gl.getUniformLocation(p, `u_sway${i + 1}`)),
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

        const positions = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1
        ]);

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

        this.buffers.position = positionBuffer;
    }

    render(currentTime, deltaTime) {
        const gl = this.gl;
        const program = this.program;

        if (!program) return;

        gl.useProgram(program);

        const locs = this.locs;
        gl.uniform2f(locs.resolution, this.width, this.height);
        gl.uniform1f(locs.time, currentTime);

        // Set toggle uniforms
        gl.uniform1i(locs.rayBeamsEnabled, this.rayBeamsEnabled ? 1 : 0);
        gl.uniform1i(locs.sunGlowEnabled, this.sunGlowEnabled ? 1 : 0);
        
        const raySpeed = 0.00005;
        for (let i = 0; i < this.rays.length; i++) {
            const ray = this.rays[i];
            const sway = Math.sin(currentTime * raySpeed * ray.speed + ray.offset) * 30;

            gl.uniform1f(locs.rays[i], ray.x);
            gl.uniform1f(locs.sways[i], sway);
        }

        gl.enableVertexAttribArray(locs.position);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.vertexAttribPointer(locs.position, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    onResize(width, height) {
        this.width = width;
        this.height = height;
        this.initRays(width);
    }

    destroy() {
        const gl = this.gl;
        if (this.program) gl.deleteProgram(this.program);
        if (this.buffers.position) gl.deleteBuffer(this.buffers.position);
    }

    toggle(enabled) {
        this.enabled = !!enabled;
        if (this.enabled && !this.program) {
            if (this.width && this.height) {
                this.init(this.width, this.height);
            }
        }
    }
}
