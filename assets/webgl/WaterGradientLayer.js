/**
 * WaterGradientLayer - Simple vertical ocean gradient
 */
export class WaterGradientLayer {
    constructor(gl) {
        this.gl = gl;
        this.program = null;
        this.buffers = {};
        
        // Color palette - ocean colors from dark to light
        const paletteHex = [
            '#000011', // 0 - deepest black-blue
            '#000a28', // 1 - very dark blue
            '#00395f', // 2 - dark blue
            '#0e4462', // 3 - dark ocean blue
            '#155d80', // 4 - medium dark blue
            '#1f7da5', // 5 - medium blue
            '#3ca4c5', // 6 - bright blue
            '#8ed2e8', // 7 - light blue
            '#c7e9f4', // 8 - very light blue
            '#ffffff'  // 9 - white
        ];

        const hexToRgb = (hex) => {
            const h = hex.replace('#', '');
            const r = parseInt(h.substring(0,2), 16) / 255;
            const g = parseInt(h.substring(2,4), 16) / 255;
            const b = parseInt(h.substring(4,6), 16) / 255;
            return [r, g, b];
        };

        const paletteRgb = paletteHex.map(hexToRgb);
        
        const getColor = (index, alpha) => {
            const rgb = paletteRgb[index];
            return [rgb[0], rgb[1], rgb[2], alpha];
        };

        // Define gradient colors from palette
        const surfaceColor = getColor(6, 1.0);  // Bright blue for surface (top)
        const depthColor = getColor(1, 1.0);    // Very dark blue for depth (bottom)

        // Single vertical gradient (topColor = surface, bottomColor = depth)
        this.gradient = {
            topColor: depthColor,      // Dark at top of screen
            bottomColor: surfaceColor  // Light at bottom (surface)
        };
    }

    init(width, height) {
        this.width = width;
        this.height = height;
        this.compileShaders();
        this.createBuffers();
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
            
            uniform vec4 u_topColor;
            uniform vec4 u_bottomColor;
            uniform float u_time;
            
            float random(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
            }

            // Underwater caustics: two families of ridged sine waves interfering.
            // Creates the characteristic bright-network pattern of refracted surface light.
            float caustics(vec2 uv, float t) {
                // Aspect-correct: compress Y so patterns aren't too elongated
                vec2 p = uv * vec2(5.5, 3.5);

                // Family A — drifting diagonally
                float a1 = abs(sin(p.x * 1.10 + sin(p.y * 0.85 + t * 0.06) * 1.30 + t * 0.04));
                float a2 = abs(sin(p.y * 0.95 + sin(p.x * 1.20 - t * 0.05) * 1.15 - t * 0.03));

                // Family B — slower, wider, perpendicular bias
                float b1 = abs(sin(p.x * 0.70 - sin(p.y * 1.30 + t * 0.04) * 0.90 + t * 0.025));
                float b2 = abs(sin(p.y * 0.80 + sin(p.x * 0.65 - t * 0.03) * 1.05 - t * 0.02));

                // Ridged = 1 - abs(sin(...)), gives bright lines at wave crests
                float netA = (1.0 - a1) * (1.0 - a2);   // bright nodes where A waves meet
                float netB = (1.0 - b1) * (1.0 - b2);

                // Blend both families
                float pattern = max(netA, netB * 0.7);

                // Sharpen: only the brightest intersections are caustic hotspots
                return pow(pattern, 2.8);
            }
            
            void main() {
                // Base gradient
                float t = pow(v_uv.y, 1.6);
                vec4 baseColor = mix(u_topColor, u_bottomColor, t);

                // Caustics — visible only in upper portion (near surface), fade to zero at depth
                float surfaceFade = smoothstep(0.0, 0.65, v_uv.y); // 0 at bottom, 1 near top
                float c = caustics(v_uv, u_time);
                // Warm teal tint matching the surface light colour
                vec3 causticColor = vec3(0.55, 0.88, 1.0);
                baseColor.rgb += causticColor * c * 0.13 * surfaceFade;
            
                // Dithering to kill banding
                float grain = random(gl_FragCoord.xy) * 0.015;
                baseColor.rgb += grain;

                // Viněta — tmavé okraje, eliptická (širší horizontálně)
                vec2 vCenter = v_uv - vec2(0.5, 0.5);
                vCenter.x *= 0.75; // elipsa: méně agresivní na šíři
                float vDist = length(vCenter) * 1.55;
                float vignette = 1.0 - smoothstep(0.45, 1.05, vDist);
                baseColor.rgb *= vignette;

                outColor = baseColor;
            }
        `;

        this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
        if (this.program) {
            const gl = this.gl;
            const p = this.program;
            this.locs = {
                time: gl.getUniformLocation(p, 'u_time'),
                topColor: gl.getUniformLocation(p, 'u_topColor'),
                bottomColor: gl.getUniformLocation(p, 'u_bottomColor'),
                position: gl.getAttribLocation(p, 'a_position'),
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
            gl.deleteShader(vertexShader);
            return null;
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);

        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            console.error('Fragment shader error:', gl.getShaderInfoLog(fragmentShader));
            gl.deleteShader(fragmentShader);
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
        if (locs.time) gl.uniform1f(locs.time, currentTime * 0.001);
        if (locs.topColor) gl.uniform4fv(locs.topColor, this.gradient.topColor);
        if (locs.bottomColor) gl.uniform4fv(locs.bottomColor, this.gradient.bottomColor);

        gl.enableVertexAttribArray(locs.position);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.position);
        gl.vertexAttribPointer(locs.position, 2, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    onResize(width, height) {
        this.width = width;
        this.height = height;
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
