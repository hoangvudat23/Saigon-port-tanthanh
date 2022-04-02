import React, { useState, useEffect, useRef } from 'react'
import PaintBrush from './components/PaintBrush'
import { useSelector, useDispatch } from 'react-redux'
import { listenToSlidersEvents } from '../../../redux/actions'
import {
  _proccessAccessData,
  _proccessGridData,
  _postMapEditsToCityIO,
} from '../../../utils/utils'
import { StaticMap } from 'react-map-gl'
import DeckGL from '@deck.gl/react'
import 'mapbox-gl/dist/mapbox-gl.css'
import settings from '../../../settings/settings.json'
import AnimationComponent from './components/AnimationComponent'
import { updateSunDirection, _setupSunEffects } from '../../../utils/utils'
import {
  AccessLayer,
  AggregatedTripsLayer,
  ABMLayer,
  GridLayer,
  TextualLayer,
  GeojsonLayer,
} from './deckglLayers'

import axios from 'axios'
// import onlyMapSetting from '../../../settings/onlyMapSetting.json';
import { tables } from "../../../settings/tableList.json";

// const mergeBuilding = (currentScennario) => {
//   // currentSceanrio = "tanthuan_a1b2c3d4" -> then split by "_" and get arr[1]
//   let buildingPhrase = (currentScennario.split("_"))[1];
//   // get two characters by step: a1b2c3d4 => [a1, b2, c3, d4];
//   let buildingSegments = buildingPhrase.match(/.{1,2}/g);
//   // get data building then merge into 1
//   async function fetchBuildingData() {
//     let resBuilding0 = await fetch(`./Building_${buildingSegments[0]}_geo.json`);
//     let resBuilding1 = await fetch(`./Building_${buildingSegments[1]}_geo.json`);
//     let resBuilding2 = await fetch(`./Building_${buildingSegments[2]}_geo.json`);
//     let resBuilding3 = await fetch(`./Building_${buildingSegments[3]}_geo.json`);
//     let building = resBuilding0;
//     building.features.push(...resBuilding1.features, ...resBuilding2.features, ...resBuilding3.features);
//     return building;
//   }
//   return fetchBuildingData();
// }

export default function Map(props) {
  const pitchMap = props.pitchMap
  const zoomMap = props.zoomMap
  const autoRotate = props.autoRotate
  const onlyMap = props.onlyMap
  const [draggingWhileEditing, setDraggingWhileEditing] = useState(false)
  const [selectedCellsState, setSelectedCellsState] = useState(null)
  const [viewState, setViewState] = useState(settings.map.initialViewState)
  const [keyDownState, setKeyDownState] = useState(null)
  const [mousePos, setMousePos] = useState(null)
  const [mouseDown, setMouseDown] = useState(null)
  const [hoveredObj, setHoveredObj] = useState(null)
  const [access, setAccess] = useState(null)
  const [textualData, setTextualData] = useState(null)

  const [geojsonData, setGeojsonData] = useState(null)

  const [GEOGRID, setGEOGRID] = useState(null)
  const [ABM, setABM] = useState({})
  const [loaded, setLoaded] = useState(false)
  const effectsRef = useRef()
  const deckGL = useRef()

  const dispatch = useDispatch()

  const pickingRadius = 40

  const [
    cityioData,
    sliders,
    menu,

    selectedType,
    ABMmode,
  ] = useSelector((state) => [
    state.CITYIO,
    state.SLIDERS,
    state.MENU,
    state.SELECTED_TYPE,
    state.ABM_MODE,
  ])

  const currentScennario = useSelector((state) => state.CURRENT_SCENARIO);
  // init building params - old
  // const [building0, setBuilding0] = useState(null)
  // const [building2, setBuilding2] = useState(null)
  // const [building3, setBuilding3] = useState(null)
  const [building, setBuilding] = useState(null);
  const [onlyMapSetting, setOnlyMapSetting] = useState({ "width": 3840, "height": 2160, "latitude": 10.760653375134037, "longitude": 106.70481804447535, "zoom": 15.95557891525241, "bearing": 0.35, "pitch": 0, "altitude": 1.5, "maxZoom": 20, "minZoom": 0, "maxPitch": 60, "minPitch": 0 })

  var ABMOn = menu.includes('ABM')
  if (autoRotate) {
    var rotateOn = autoRotate;
  } else {
    var rotateOn = menu.includes('ROTATE')
  }
  var shadowsOn = menu.includes('SHADOWS')
  var editOn = menu.includes('EDIT')
  var resetViewOn = menu.includes('RESET_VIEW')

  const getAPICall = async (URL) => {
    try {
      const response = await axios.get(URL);
      return response.data;
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    // fix deck view rotate
    _rightClickViewRotate()
    // setup sun effects
    _setupSunEffects(effectsRef, cityioData.GEOGRID.properties.header)
    // // zoom map on CS table location
    // _setViewStateToTableHeader()
    setLoaded(true)

    // set bright time
    let brightTime = 12;
    if (cityioData.GEOGRID.properties.header.tz) {
      brightTime += cityioData.GEOGRID.properties.header.tz;
    }
    updateSunDirection(brightTime, effectsRef)

    // Fetch onlyMapSetting data
    async function fetchOnlyMapSettingData() {
      const resOnlyMapSetting = await getAPICall(`${process.env.REACT_APP_EXPRESS_PUBLIC_URL}/get-only-map-setting`);
      if (resOnlyMapSetting) {
        setOnlyMapSetting(resOnlyMapSetting);
      }
    }
    fetchOnlyMapSettingData();

    // Fetch building data - old
    // async function fetchBuildingData() {
    //   const resBuilding0 = await fetch('./Building_0.json');
    //   setBuilding0(await resBuilding0.json());
    //   const resBuilding2 = await fetch('./Building_2.json');
    //   setBuilding2(await resBuilding2.json());
    //   const resBuilding3 = await fetch('./Building_3.json');
    //   setBuilding3(await resBuilding3.json());
    // }
    // fetchBuildingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // MERGE BUILDING
  useEffect(() => {
    // currentSceanrio = "tanthuan_a1b2c3d4" -> then split by "_" and get arr[1]
    let buildingPhrase = (currentScennario.split("_"))[1];
    // get two characters by step: a1b2c3d4 => [a1, b2, c3, d4];
    let buildingSegments = buildingPhrase.match(/.{1,2}/g);
    // get data building then merge into 1
    async function fetchBuildingData() {
      let resBuildingBase = await fetch(`./Building_Noninteractive_geo.json`);
      resBuildingBase = await resBuildingBase.json();
      let resBuilding0 = await fetch(`./Building_${buildingSegments[0]}_geo.json`);
      resBuilding0 = await resBuilding0.json();
      let resBuilding1 = await fetch(`./Building_${buildingSegments[1]}_geo.json`);
      resBuilding1 = await resBuilding1.json();
      let resBuilding2 = await fetch(`./Building_${buildingSegments[2]}_geo.json`);
      resBuilding2 = await resBuilding2.json();
      let resBuilding3 = await fetch(`./Building_${buildingSegments[3]}_geo.json`);
      resBuilding3 = await resBuilding3.json();
      let building = resBuildingBase;
      building.features.push(...resBuilding0.features, ...resBuilding1.features, ...resBuilding2.features, ...resBuilding3.features);
      setBuilding(building);
    }
    fetchBuildingData();
  }, [currentScennario]);

  useEffect(() => {
    // zoom map on CS table location
    _setViewStateToTableHeader()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyMapSetting])

  useEffect(() => {
    if (!loaded) return
    updateSunDirection(sliders.time[1], effectsRef)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliders.time])

  useEffect(() => {
    if (!loaded) return
    let shadowColor = shadowsOn ? [0, 0, 0, 0.5] : [0, 0, 0, 0];
    if (effectsRef.current && effectsRef.current[0]) {
      effectsRef.current[0].shadowColor = shadowColor;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shadowsOn])

  useEffect(() => {
    setGEOGRID(_proccessGridData(cityioData))

    if (cityioData.access) {
      setAccess(_proccessAccessData(cityioData.access))
    }

    if (cityioData.textual) {
      setTextualData(cityioData.textual)
    }

    if (cityioData.geojson) {
      setGeojsonData(cityioData.geojson)
    }

    if (cityioData.ABM2) {
      setABM(cityioData.ABM2)
    }
  }, [cityioData])

  useEffect(() => {
    if (!loaded) return
    if (!editOn) {
      let dataProps = []

      for (let i = 0; i < GEOGRID.features.length; i++) {
        dataProps[i] = GEOGRID.features[i].properties
      }
      _postMapEditsToCityIO(dataProps, cityioData.tableName, '/GEOGRIDDATA')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editOn])

  useEffect(() => {
    if (!loaded) return
    _setViewStateToTableHeader()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetViewOn])

  const writeOnlyMapSetting = () => {
    if (window.confirm("Are you sure to save this?")) {
      axios.post(`${process.env.REACT_APP_EXPRESS_PUBLIC_URL}/save-only-map-settings`, {
        setting: JSON.stringify(viewState)
      }).then(res => {
        alert(res.data);
      }).catch(err => {
        alert('Failed to save settings');
        console.log(err);
      })
    }
  }

  const onViewStateChange = ({ viewState }) => {
    setViewState(viewState)
  }

  // /**
  //  * resets the camera viewport
  //  * to cityIO header data
  //  * https://github.com/uber/deck.gl/blob/master/test/apps/viewport-transitions-flyTo/src/app.js
  //  */

  const _setViewStateToTableHeader = () => {
    const header = cityioData.GEOGRID.properties.header

    setViewState({
      ...viewState,
      // longitude: header.longitude,
      // latitude: header.latitude,
      // bearing: 360 - header.rotation,
      longitude: onlyMapSetting.longitude ? onlyMapSetting.longitude : 106.704854, // District 4
      latitude: onlyMapSetting.latitude ? onlyMapSetting.latitude : 10.760616, // District 4
      bearing: -90, // District 4
      zoom: zoomMap ? zoomMap : (onlyMapSetting.zoom ? onlyMapSetting.zoom : 15.95), // 4k
      pitch: pitchMap ? pitchMap : 0,
      orthographic: true,
    })
  }

  // /**
  //  * Description. fix deck issue
  //  * with rotate right botton
  //  */
  const _rightClickViewRotate = () => {
    document
      .getElementById('deckgl-wrapper')
      .addEventListener('contextmenu', (evt) => evt.preventDefault())
  }
  // map building - old
  // const getBuildingByCurrentScenario = () => {
  //   switch (currentScennario) {
  //     case 'hcm_scenario_0':
  //       return building0;
  //     case 'hcm_scenario_2':
  //       return building2;
  //     case 'hcm_scenario_3':
  //       return building3;
  //     default:
  //       return building0;
  //   }
  // }

  const layersKey = {
    ABM: ABMLayer({
      data: ABM.trips,
      cityioData,
      ABMmode,
      zoomLevel: viewState.zoom,
      sliders,
    }),
    AGGREGATED_TRIPS: AggregatedTripsLayer({
      data: ABM.trips,
      cityioData,
      ABMmode,
    }),
    GRID: !onlyMap ? GridLayer({
      data: GEOGRID,
      editOn: menu.includes('EDIT'),
      state: {
        selectedType,
        keyDownState,
        selectedCellsState,
        pickingRadius,
      },
      updaters: {
        setSelectedCellsState,
        setDraggingWhileEditing,
        setHoveredObj,
      },
      deckGL,
    }) : GeojsonLayer({
      data: GEOGRID,
    }),
    // GRID: GeojsonLayer({
    //   data: GEOGRID,
    // }),
    ACCESS: AccessLayer({
      data: access,
      cellSize: cityioData.GEOGRID?.properties?.header.cellSize,
    }),
    TEXTUAL: TextualLayer({
      data: textualData && textualData,
      coordinates: GEOGRID,
    }),

    GEOJSON: GeojsonLayer({
      data: geojsonData && geojsonData,
      alphaColor: 180,
    }),

    OUTSIDE_INTERACTIVE_AREA: GeojsonLayer({
      data: building,
      isTv1: false,
    }),
  }

  const layerOrder = [
    'TEXTUAL',
    'AGGREGATED_TRIPS',
    'GEOJSON',
    'GRID',
    'ACCESS',
    'ABM',
  ]

  const _renderLayers = () => {
    let layers = []
    if (!pitchMap) {
      for (var layer of layerOrder) {
        if (menu.includes(layer)) {
          layers.push(layersKey[layer])
        }
      }
    }
    else {
      /* Add Building layer if having pitchMap*/
      // if (currentScennario == 'hcm_scenario_0') {
      layers.push(layersKey['OUTSIDE_INTERACTIVE_AREA']);
      // }
      /* --! Add Building */
    }
    return layers
  }
  return (
    <div
      className="baseMap"
      onKeyDown={(e) => {
        setKeyDownState(e.nativeEvent.key);
        if (onlyMap) {
          if (e.nativeEvent.keyCode == 13) {
            console.log(e.nativeEvent);
            writeOnlyMapSetting();
          }
        }
      }}
      onKeyUp={() => setKeyDownState(null)}
      onMouseMove={(e) => setMousePos(e.nativeEvent)}
      onMouseUp={() => setMouseDown(false)}
      onMouseDown={() => setMouseDown(true)}
    >
      <PaintBrush
        editOn={editOn}
        mousePos={mousePos}
        selectedType={selectedType}
        pickingRadius={pickingRadius}
        mouseDown={mouseDown}
        hoveredObj={hoveredObj}
      />
      <AnimationComponent
        toggles={{ ABMOn, rotateOn }}
        state={{ sliders, viewState }}
        updaters={{
          listenToSlidersEvents,
          updateSunDirection,
          setViewState,
        }}
        dispatch={dispatch}
      />

      <DeckGL
        ref={deckGL}
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        layers={_renderLayers()}
        effects={effectsRef.current}
        controller={{
          touchZoom: onlyMap || pitchMap ? false : true,
          touchRotate: onlyMap || pitchMap ? false : true,
          scrollZoom: {
            speed: onlyMap ? 0.01 : 0.1,
            smooth: true,
          },
          dragPan: !draggingWhileEditing,
          dragRotate: onlyMap || pitchMap ? false : !draggingWhileEditing,
          keyboard: true,
        }}
        style={{
          marginTop: pitchMap ? '-50px' : '0', // If onlyChartSidebar 
        }}
      >
        <StaticMap
          asyncRender={false}
          dragRotate={true}
          reuseMaps={true}
          mapboxApiAccessToken={process.env.REACT_APP_MAPBOX_TOKEN}
          mapStyle={autoRotate ? "" : settings.map.mapStyle.sat}
          preventStyleDiffing={true}
        />
      </DeckGL>
    </div>
  )
}
