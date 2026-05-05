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
            
            //
            // Simple random noise
            //
            float random(vec2 p) {
                return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
            }
            
            //
            // Smooth noise
            //
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
            
                float a = random(i);
                float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0));
                float d = random(i + vec2(1.0, 1.0));
            
                vec2 u = f * f * (3.0 - 2.0 * f);
            
                return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }
            
            void main() {
                // Base gradient
                float t = pow(v_uv.y, 1.6); // makes deep water darker faster
                vec4 baseColor = mix(u_topColor, u_bottomColor, t);
            
                // Light caustics (very fake, but works)
                float n = noise(v_uv * 6.0 + vec2(u_time * 0.05, u_time * 0.1));
                float caustics = smoothstep(0.75, 1.0, n);
                baseColor.rgb += caustics * 0.05;
            
                // Dithering to kill banding
                float grain = random(gl_FragCoord.xy) * 0.015;
                baseColor.rgb += grain;
            
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
