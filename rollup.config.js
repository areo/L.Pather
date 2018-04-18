import pkg from './package.json'
import typescript from 'rollup-plugin-typescript2'

export default {
    input: './src/pather.ts',

    output: {
        file: pkg.main,
        format: 'iife',
        name: 'L.Pather',
        footer: 'module.exports = this.L.Pather;',
        globals: { leaflet: 'L', d3: 'd3' }
    },
    external: ['leaflet', 'd3'],

    plugins: [typescript()]
}
