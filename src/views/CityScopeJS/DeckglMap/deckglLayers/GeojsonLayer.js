import { GeoJsonLayer } from 'deck.gl'
import { hexToRgb } from '../../../../utils/utils'

export default function GeojsonLayer({ data }) {
  return new GeoJsonLayer({
    id: 'GeojsonLayer',
    data,
    pickable: true,
    wireframe: true,
    stroked: false,
    filled: true,
    extruded: true,
    lineWidthScale: 1,
    getFillColor: (d) => { return d.properties.TypeCode == "DGT" ? [0, 0, 0, 0] : hexToRgb(d.properties.fill, 180) }, // push alpha
    getLineColor: (d) => hexToRgb(d.properties.stroke),
    lineWidthMinPixels: 2,
    getElevation: (d) => d.properties.height,
  })
}
