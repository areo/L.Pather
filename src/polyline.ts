import Mode from './mode'
import { Polyline, DivIcon, Marker, LineUtil } from 'leaflet'

export interface PatherPolylineMethods {
    fire?: (string, any) => void
    mode?: () => number
    remove?: (any) => void
}

export class PatherPolyline {
    polyline: L.Polyline
    manipulating: L.Marker
    edges = []

    constructor(
        private map: L.Map,
        latLngs: L.LatLng[],
        private options: L.PolylineOptions,
        private methods: PatherPolylineMethods
    ) {
        this.polyline = new Polyline(latLngs, this.options).addTo(map)
        this.edges = []
        this.manipulating = null

        this.attachPolylineEvents(this.polyline)
        this.select()
    }

    select(): void {
        this.attachElbows()
    }

    deselect(): void {
        this.manipulating = null
    }

    attachElbows(): void {
        this.detachElbows()

        this.getLatLngs().forEach(latLng => {
            const icon = new DivIcon({ className: 'elbow' })
            const edge = new Marker(latLng, { icon }).addTo(this.map)

            this.attachElbowEvents(edge)
            this.edges.push(edge)
        })
    }

    detachElbows(): void {
        this.edges.forEach(edge => this.map.removeLayer(edge))
        this.edges.length = 0
    }

    attachPolylineEvents(polyline: L.Polyline): void {
        polyline.on('click', (event: L.LeafletMouseEvent) => {
            event.originalEvent.stopPropagation()
            event.originalEvent.preventDefault()

            if (this.methods.mode() & Mode.APPEND) {
                // Appending takes precedence over deletion!
                const latLng = this.map.mouseEventToLatLng(event.originalEvent)
                this.insertElbow(latLng)
            } else if (this.methods.mode() & Mode.DELETE) {
                this.methods.remove(this)
            }
        })
    }

    attachElbowEvents(marker: L.Marker): void {
        marker.on('mousedown touchstart', (event: L.LeafletMouseEvent) => {
            const originalEvent: Event = event.originalEvent

            if (this.methods.mode() & Mode.EDIT) {
                if (originalEvent.stopPropagation) {
                    originalEvent.stopPropagation()
                    originalEvent.preventDefault()
                }

                this.manipulating = marker
            }
        })

        marker.on('mouseup touchend', (event: L.LeafletMouseEvent) => {
            const { originalEvent } = event

            if (originalEvent.stopPropagation) {
                originalEvent.stopPropagation()
                originalEvent.preventDefault()
            }

            this.manipulating = null
        })
    }

    insertElbow(latLng: L.LatLng): void {
        const newPoint = this.map.latLngToLayerPoint(latLng)
        let leastDistance = Infinity
        let insertAt = -1
        const points = this.getLatLngs().map(latLng =>
            this.map.latLngToLayerPoint(latLng)
        )

        points.forEach((currentPoint, index) => {
            const nextPoint = points[index + 1] || points[0]
            const distance = LineUtil.pointToSegmentDistance(
                newPoint,
                currentPoint,
                nextPoint
            )

            if (distance < leastDistance) {
                leastDistance = distance
                insertAt = index
            }
        })

        points.splice(insertAt + 1, 0, newPoint)

        const parts = points.map(point => {
            const latLng = this.map.layerPointToLatLng(point)
            return { _latlng: latLng }
        })

        this.redraw(parts)
        this.attachElbows()
    }

    moveTo(point: L.Point): void {
        this.manipulating.setLatLng(this.map.layerPointToLatLng(point))
        this.redraw(this.edges)
    }

    finished(): void {
        this.methods.fire('edited', {
            polyline: this,
            latLngs: this.polyline.getLatLngs()
        })
    }

    redraw(edges: Array<any>): void {
        const latLngs = edges.map(edge => edge._latlng)
        const options: L.PolylineOptions = { ...this.options, smoothFactor: 0 }

        this.softRemove(false)
        this.polyline = new Polyline(latLngs, options).addTo(this.map)
        this.attachPolylineEvents(this.polyline)
    }

    softRemove(edgesToo: boolean = true): void {
        this.map.removeLayer(this.polyline)

        if (edgesToo) {
            this.edges.forEach(edge => {
                this.map.removeLayer(edge)
            })
        }
    }

    getLatLngs(): L.LatLng[] {
        return this.polyline.getLatLngs() as L.LatLng[]
    }
}
