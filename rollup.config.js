import pkg from './package.json'
import typescript from 'rollup-plugin-typescript2'

export default {
    input: './src/pather.ts',

    output: [
        {
            file: pkg.main,
            format: 'umd',
            name: 'L.Pather',
            globals: { leaflet: 'L', d3: 'd3' }
        },
        {
            file: pkg.module,
            format: 'es'
        }
    ],
    external: ['leaflet', 'd3'],

    plugins: [typescript()]
}
