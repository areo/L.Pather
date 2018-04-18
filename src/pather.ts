import { Point, FeatureGroup } from 'leaflet'
import * as d3 from 'd3'
import Mode from './mode'
import { PatherPolyline } from './polyline'

interface PatherOptions extends L.PolylineOptions {
    mode?: Mode
    moduleClass?: string
    lineClass?: string
    elbowClass?: string
    detectTouch?: boolean
    removePolylines?: boolean
    strokeColour?: string
    strokeWidth?: number
    width?: string
    height?: string
    pathColour?: string
    pathOpacity?: number
    pathWidth?: number
}

export default class Pather extends FeatureGroup {
    static MODE = Mode

    map: L.Map
    element: HTMLElement
    svg: any
    fromPoint: L.Point
    creating: boolean = false
    polylines: PatherPolyline[] = []
    eventHandlers = {}
    draggingState: boolean = false
    latLngs: L.LatLng[] = []

    constructor(private options: PatherOptions = {}) {
        super()
        this.options = { ...this.defaultOptions(), ...options }
    }

    createPath(latLngs: L.LatLng[]): PatherPolyline | boolean {
        if (latLngs.length <= 1) {
            return false
        }

        this.clearAll()

        var polyline = new PatherPolyline(this.map, latLngs, this.options, {
            fire: this.fire.bind(this),
            mode: this.getMode.bind(this),
            remove: this.removePath.bind(this)
        })

        this.polylines.push(polyline)

        this.fire('created', {
            polyline: polyline,
            latLngs: polyline.getLatLngs()
        })

        return polyline
    }

    removePath(model: PatherPolyline): boolean {
        if (model instanceof PatherPolyline) {
            var indexOf = this.polylines.indexOf(model)
            this.polylines.splice(indexOf, 1)

            model.softRemove()

            this.fire('deleted', { polyline: model, latLngs: [] })

            return true
        }

        return false
    }

    getPaths(): PatherPolyline[] {
        return this.polylines
    }

    onAdd(map: L.Map): this {
        this.map = map
        this.element = map.getContainer()
        this.draggingState = map.dragging.enabled()
        this.fromPoint = new Point(0, 0, false)
        this.svg = d3
            .select(this.element)
            .append('svg')
            .attr('pointer-events', 'none')
            .attr('class', this.getOption('moduleClass'))
            .attr('width', this.getOption('width'))
            .attr('height', this.getOption('height'))

        map.dragging.disable()

        // Attach the mouse events for drawing the polyline.
        this.attachEvents(map)
        this.setMode(this.options.mode)

        return this
    }

    onRemove(map: L.Map): this {
        this.svg.remove()

        if (this.options.removePolylines) {
            var length = this.polylines.length

            while (length--) {
                this.removePath(this.polylines[length])
            }
        }

        this.map.off('mousedown', this.mouseDownHandler, this)
        this.map.off('mousemove', this.mouseMoveHandler, this)
        this.map.off('mouseup', this.mouseUpHandler, this)
        this.map
            .getContainer()
            .removeEventListener('mouseleave', this.mouseLeaveHandler)

        this.element.classList.remove('mode-create')
        this.element.classList.remove('mode-delete')
        this.element.classList.remove('mode-edit')
        this.element.classList.remove('mode-append')

        const tileLayer: HTMLElement = this.map
            .getContainer()
            .querySelector('.leaflet-tile-pane')
        const originalState = this.draggingState ? 'enable' : 'disable'
        tileLayer.style.pointerEvents = 'all'
        this.map.dragging[originalState]()

        return this
    }

    edgeBeingChanged(): PatherPolyline {
        const edges = this.polylines.filter(
            polyline => polyline.manipulating != null
        )
        return edges.length === 0 ? null : edges[0]
    }

    isPolylineCreatable(): boolean {
        return !!(this.options.mode & Mode.CREATE)
    }

    mouseDownHandler(event: L.LeafletMouseEvent) {
        const latLng = this.map.mouseEventToLatLng(event.originalEvent)

        if (this.isPolylineCreatable() && !this.edgeBeingChanged()) {
            this.creating = true
            this.fromPoint = this.map.latLngToContainerPoint(latLng)
            this.latLngs = []
        }
    }

    mouseMoveHandler(event: L.LeafletMouseEvent): void {
        const point = this.map.mouseEventToContainerPoint(event.originalEvent)

        if (this.edgeBeingChanged()) {
            this.edgeBeingChanged().moveTo(
                this.map.containerPointToLayerPoint(point)
            )
            return
        }

        const lineFunction = d3
            .line<L.Point>()
            .x(d => d.x)
            .y(d => d.y)
            .curve(d3.curveLinear)

        if (this.creating) {
            var lineData = [this.fromPoint, new Point(point.x, point.y, false)]
            this.latLngs.push(this.map.containerPointToLatLng(point))

            this.svg
                .append('path')
                .classed('drawing-line', true)
                .attr('d', lineFunction(lineData))
                .attr('stroke', this.getOption('strokeColour'))
                .attr('stroke-width', this.getOption('strokeWidth'))
                .attr('fill', 'none')

            this.fromPoint = new Point(point.x, point.y, false)
        }
    }

    mouseLeaveHandler(): void {
        this.clearAll()
        this.creating = false
    }

    mouseUpHandler(): void {
        if (this.creating) {
            this.creating = false
            this.createPath(this.latLngs)
            this.latLngs = []
            return
        }

        const edgeBeingChanged = this.edgeBeingChanged()
        if (!edgeBeingChanged) return

        edgeBeingChanged.attachElbows()
        edgeBeingChanged.finished()
        edgeBeingChanged.manipulating = null
    }

    /**
     * @method attachEvents
     * @param {L.Map} map
     * @return {void}
     */
    attachEvents(map: L.Map): void {
        this.eventHandlers = {
            mouseDown: this.mouseDownHandler.bind(this),
            mouseMove: this.mouseMoveHandler.bind(this),
            mouseUp: this.mouseUpHandler.bind(this),
            mouseLeave: this.mouseLeaveHandler.bind(this)
        }

        this.map.on('mousedown', this.mouseDownHandler, this)
        this.map.on('mousemove', this.mouseMoveHandler, this)
        this.map.on('mouseup', this.mouseUpHandler, this)
        this.map
            .getContainer()
            .addEventListener('mouseleave', this.mouseLeaveHandler.bind(this))

        // Attach the mobile events that delegate to the desktop events.
        this.map
            .getContainer()
            .addEventListener('touchstart', this.fire.bind(map, 'mousedown'))
        this.map
            .getContainer()
            .addEventListener('touchmove', this.fire.bind(map, 'mousemove'))
        this.map
            .getContainer()
            .addEventListener('touchend', this.fire.bind(map, 'mouseup'))
    }

    /**
     * @method clearAll
     * @return {void}
     */
    clearAll(): void {
        this.svg.text('')
    }

    /**
     * @method getOption
     * @param {String} property
     * @return {String|Number}
     */
    getOption(property: string): string | number {
        return this.options[property] || this.defaultOptions()[property]
    }

    /**
     * @method defaultOptions
     * @return {Object}
     */
    defaultOptions(): PatherOptions {
        return {
            moduleClass: 'pather',
            lineClass: 'drawing-line',
            detectTouch: true,
            elbowClass: 'elbow',
            removePolylines: true,
            strokeColour: 'rgba(0,0,0,.5)',
            strokeWidth: 2,
            width: '100%',
            height: '100%',
            smoothFactor: 10,
            pathColour: 'black',
            pathOpacity: 0.55,
            pathWidth: 3,
            mode: Mode.ALL
        }
    }

    /**
     * @method setSmoothFactor
     * @param {Number} smoothFactor
     * @return {void}
     */
    setSmoothFactor(smoothFactor: number): void {
        this.options.smoothFactor = smoothFactor
    }

    /**
     * @method setMode
     * @param {Number} mode
     * @return {void}
     */
    setMode(mode: number): void {
        this.setClassName(mode)
        this.options.mode = mode

        var tileLayer: HTMLElement = this.map
            .getContainer()
            .querySelector('.leaflet-tile-pane')

        /**
         * @method shouldDisableDrag
         * @return {Boolean}
         * @see http://www.stucox.com/blog/you-cant-detect-a-touchscreen/
         */
        const shouldDisableDrag = (): boolean => {
            if (
                this.options.detectTouch &&
                ('ontouchstart' in window || 'onmsgesturechange' in window)
            ) {
                return (
                    !!(this.options.mode & Mode.CREATE) ||
                    !!(this.options.mode & Mode.EDIT)
                )
            }

            return !!(this.options.mode & Mode.CREATE)
        }

        if (shouldDisableDrag()) {
            var originalState = this.draggingState ? 'disable' : 'enable'
            tileLayer.style.pointerEvents = 'none'
            return void this.map.dragging[originalState]()
        }

        tileLayer.style.pointerEvents = 'all'
        this.map.dragging.enable()
    }

    /**
     * @method setClassName
     * @param {Number} mode
     * @return {void}
     */
    setClassName(mode: number): void {
        /**
         * @method conditionallyAppendClassName
         * @param {String} modeName
         * @return {void}
         */
        const conditionallyAppendClassName = (modeName: string): void => {
            var className = ['mode', modeName].join('-')

            if (Mode[modeName.toUpperCase()] & mode) {
                return void this.element.classList.add(className)
            }

            this.element.classList.remove(className)
        }

        conditionallyAppendClassName('create')
        conditionallyAppendClassName('delete')
        conditionallyAppendClassName('edit')
        conditionallyAppendClassName('append')
    }

    getMode(): number {
        return this.options.mode
    }

    setOptions(options: PatherOptions): void {
        this.options = { ...this.options, ...options }
    }
}
