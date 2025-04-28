import './style.css';
import "./style-reset.css"
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';
import ScaleLine from 'ol/control/ScaleLine.js';
import OverviewMap from 'ol/control/OverviewMap.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import VectorLayer from 'ol/layer/Vector.js';
import TileWMS from 'ol/source/TileWMS.js';
import VectorSource from 'ol/source/Vector.js';
import Style from 'ol/style/Style.js';
import LayerGroup from 'ol/layer/Group';
import Overlay from 'ol/Overlay.js'
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import Draw from 'ol/interaction/Draw.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import WFS from 'ol/format/WFS.js';
import RegularShape from 'ol/style/RegularShape.js';
import Stroke from 'ol/style/Stroke.js';

const map = new Map({
  layers: [
    new TileLayer({
      source: new OSM(),
    })
  ],
  target: "map",
  view: new View({
    center: fromLonLat([19.1451, 48.7363]),
    zoom: 13,
  }),
  controls: [
    new ScaleLine(),
    new OverviewMap({
      layers: [
        new TileLayer({
          source: new OSM()
        })
      ],
    })
  ]
});


// WMS vrstvy
const WMSGeologicalWells = new TileLayer({
  source: new TileWMS({
    url: "https://ags.geology.sk/arcgis/services/WebServices/VRTY/MapServer/WMSServer",
    params: {
      "LAYERS": "0",
      "TILED": true,
      "FORMAT": "image/png",
      "TRANSPARENT": true,
    },
  }),
  visible: false,
  title: "GeologicalWells"
})

const WMSSurfaceWaterBodies = new TileLayer({
  source: new TileWMS({
    url: "https://geoserver.vuvh.sk/arcgis/services/INSPIRE/PD_WFDLakes/MapServer/WMSServer",
    params: {
      "LAYERS": "LAKES",
      "FORMAT": "image/png",
      "TRANSPARENT": true,
      "CRS": "EPSG:5514"
    }
  }),
  visible: false,
  title: "WaterBodies"
})

// GEOJSON vrstvy 
const GeoJSONCountries = new VectorLayer({
  source: new VectorSource({
    format: new GeoJSON(),
    url: "./data_geoJSON/countries.json"
  }),
  visible: false,
  title: "GeoJsonCountries"
})

const AllLayerGroup = new LayerGroup({
  layers: [
    GeoJSONCountries,
    WMSSurfaceWaterBodies,
    WMSGeologicalWells,
  ]
})
map.addLayer(AllLayerGroup)

// Prepínanie vrstiev
const layerBtns = document.querySelectorAll(".layers-btns > input[type=checkbox]")
let legendGeologWells = document.querySelector(".legend-geolog-wells")
let legendWaterBodies = document.querySelector(".legend-water-bodies")

layerBtns.forEach((oneLayerBtn) => {
  oneLayerBtn.addEventListener("change", (e) => {
    let btnValue = e.target.value

    let tileLayer = (AllLayerGroup.getLayers().getArray().find((layer) => layer.get("title") === btnValue))

    if (tileLayer) {
      tileLayer.setVisible(e.target.checked)

      if (btnValue === "GeologicalWells") {
        legendGeologWells.classList.toggle("active-legend", e.target.checked);
      } else if (btnValue === "WaterBodies") {
        legendWaterBodies.classList.toggle("active-legend", e.target.checked);
      }
    }
  })
})

// Bodová vrstva Námestie SNP
const snpPoint = new Feature({
  geometry: new Point([2131234.966974343, 6230075.272327807]),
  location: "Námestie SNP, Banská Bystrica"
})

snpPoint.setStyle(new Style({
  image: new RegularShape({
    points: 4,
    radius: 7,
    fill: new Fill({ color: "red" }),
    stroke: new Stroke({ color: "black", width: 1 })
  })
}))

const pointLayer = new VectorLayer({
  source: new VectorSource({
    features: [snpPoint]
  })
})
map.addLayer(pointLayer)



// Popup a overlay
const popupContainer = document.querySelector(".popup-container")
const popupTextName = document.getElementById("feature-name")
const popupTextInfo = document.getElementById("feature-additional-info")
const popupCloseBtn = document.querySelector(".popup-close-btn")

const overlayLayer = new Overlay({
  element: popupContainer,
})
map.addOverlay(overlayLayer)

popupCloseBtn.addEventListener("click", () => {
  overlayLayer.setPosition(undefined)
})
map.on("singleclick", (e) => {
  const view = map.getView()
  const resolution = view.getResolution()
  const projection = view.getProjection()

  overlayLayer.setPosition(undefined)
  popupTextName.textContent = ""
  popupTextInfo.textContent = ""

  // Popup pre snpPoint a GeoJSONCountries
  map.forEachFeatureAtPixel(e.pixel, (feature, layer) => {
    const location = feature.get("location");
    const name = feature.get("name");

    if (location) {
      overlayLayer.setPosition(e.coordinate)
      popupTextName.innerHTML = `<strong>Miesto:</strong> ${feature.get("location")}`
      popupTextInfo.innerHTML = ""
    } else if (name) {
      overlayLayer.setPosition(e.coordinate)
      popupTextName.innerHTML = `<strong>Štát:</strong> ${feature.get("name")}`
      popupTextInfo.innerHTML = ""
    }
  })

  if (WMSGeologicalWells.getVisible()) {
    const url = WMSGeologicalWells.getSource().getFeatureInfoUrl(
      e.coordinate,
      resolution,
      projection,
      {
        "INFO_FORMAT": "text/xml",
        "QUERY_LAYERS": "0"
      }
    )

    if (url) {
      fetch(url)
        .then(response => response.text())
        .then(xmlText => {
          const xmlDocs = new DOMParser().parseFromString(xmlText, "text/xml")
          const fieldsElement = xmlDocs.getElementsByTagName("FIELDS")

          if (fieldsElement.length > 0) {
            const infoObject = {}

            for (let i = 0; i < fieldsElement[0].attributes.length; i++) {
              const attr = fieldsElement[0].attributes[i]
              infoObject[attr.name] = attr.value === "Null" ? null : attr.value
            }

            overlayLayer.setPosition(e.coordinate)
            popupTextInfo.innerHTML = `<strong>Účel vrtu:</strong> ${infoObject["Účelvrtu-skupina"]}`
            popupTextName.innerHTML = `<strong>Archivačné číslo správy:</strong> ${infoObject.Archívnečíslosprávy}`
          }
        })
    }
  }

  if (WMSSurfaceWaterBodies.getVisible()) {
    const url = WMSSurfaceWaterBodies.getSource().getFeatureInfoUrl(
      e.coordinate,
      resolution,
      projection,
      {
        "INFO_FORMAT": "text/xml",
        "QUERY_LAYERS": "LAKES"
      }
    )

    if (url) {
      fetch(url)
        .then(response => response.text())
        .then(xmlText => {
          const xmlDocs = new DOMParser().parseFromString(xmlText, "text/xml")
          const fieldsElement = xmlDocs.getElementsByTagName("FIELDS")

          if (fieldsElement.length > 0) {
            const infoObject = {}

            for (let i = 0; i < fieldsElement[0].attributes.length; i++) {
              const attr = fieldsElement[0].attributes[i]
              infoObject[attr.name] = attr.value === "Null" ? null : attr.value
            }

            overlayLayer.setPosition(e.coordinate)
            popupTextName.innerHTML = `<strong>Názov vodnej plochy:</strong> ${infoObject.nameText}`

          }
        })
    }
  }
})

// Nominatim API 
const markerLayer = new VectorLayer({
  source: new VectorSource()
});
map.addLayer(markerLayer);

const searchForm = document.querySelector(".search-container")
const searchInput = document.getElementById("search-input")
const removeBtn = document.getElementById("remove-btn")
const resultList = document.getElementById("result-list")

searchForm.addEventListener("submit", (e) => {
  e.preventDefault()
  const query = searchInput.value

  if (query) {
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`)
      .then(response => response.json())
      .then(parsedResult => {
        if (parsedResult.length > 0) {
          setResultList(parsedResult)
        } else {
          alert("Adresa sa nenašla")
        }
      })
  }
})

// Vymazanie hľadania a resultlistu 
removeBtn.addEventListener("click", () => {
  searchInput.value = ""
  resultList.innerHTML = ""
  markerLayer.getSource().clear()
})

// Vykreslenie výsledkov
const setResultList = (parsedResult) => {
  resultList.innerHTML = ""

  if (parsedResult.length > 3) {
    resultList.style.overflowY = "scroll"
  } else {
    resultList.style.overflowY = "hidden"
  }

  if (parsedResult.length === 0) {
    resultList.innerHTML = "<li>Adresa nebola nájdená</li>"
  }

  parsedResult.forEach((result) => {
    const liElement = document.createElement("li")
    liElement.classList.add("result-list-element")
    liElement.innerHTML = `<h3>${result.name}</h3>
                           <span>${result.addresstype}</span>
                           <p>${result.display_name}</p>`
    liElement.style.cursor = "pointer"

    liElement.addEventListener("click", () => {
      const lon = parseFloat(result.lon)
      const lat = parseFloat(result.lat)
      const coordinates = fromLonLat([lon, lat])

      markerLayer.getSource().clear()

      const marker = new Feature({
        geometry: new Point(coordinates),
        location: null
      })
      marker.setStyle(new Style({
        image: new CircleStyle({
          radius: 10,
          fill: new Fill({ color: "transparent" }),
          stroke: new Stroke({ color: "red", width: 4 })
        })
      }))
      markerLayer.getSource().addFeature(marker)

      map.getView().animate({
        center: coordinates,
        zoom: 15
      })
    })
    resultList.appendChild(liElement)

  })
}

// Funkcia polygónov
const createPoly = document.getElementById("create-poly");
const removePoly = document.getElementById("remove-poly");
const drawSource = new VectorSource();

const drawVectorLayer = new VectorLayer({
  source: drawSource
});

const draw = new Draw({
  source: drawSource,
  type: "Polygon"
});

let WFSLayer = null;
let allWFSFeatures = [];

const loadAllWFSPoints = (mapProjection) => {
  const url = "https://arc.sazp.sk/arcgis/services/env_zataze/environmentalna_zataz/MapServer/WFSServer?" +
    "service=WFS&" +
    "version=1.1.0&" +
    "request=GetFeature&" +
    "typename=env_zataze_environmentalna_zataz:EZ_ALL&" +
    "srsname=EPSG:3857";

  fetch(url)
    .then(response => response.text())
    .then(data => {
      allWFSFeatures = new WFS().readFeatures(data, {
        dataProjection: "EPSG:3857",
        featureProjection: mapProjection
      });
    });
}

// Funkcia na filtrovanie bodov podľa všetkých polygónov
const filterWFSPoints = () => {

  const polygons = drawSource.getFeatures().map(f => f.getGeometry());

  const filteredFeatures = allWFSFeatures.filter(feature => {
    const coord = feature.getGeometry().getCoordinates();
    return polygons.some(polygon => polygon.intersectsCoordinate(coord));
  });

  const filteredSource = new VectorSource({
    features: filteredFeatures
  });

  if (WFSLayer) {
    map.removeLayer(WFSLayer);
  }

  WFSLayer = new VectorLayer({
    source: filteredSource,
    style: new Style({
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: "blue" })
      })
    })
  });

  map.addLayer(WFSLayer);
}

createPoly.addEventListener("click", () => {
  if (!map.getLayers().getArray().includes(drawVectorLayer)) {
    map.addLayer(drawVectorLayer);
  }
  map.addInteraction(draw);
});
// Popup pre body v polygóne
map.on("singleclick", (e) => {
  if (!WFSLayer) return;
  else {
    map.forEachFeatureAtPixel(e.pixel, (feature, layer) => {
      if (layer === WFSLayer) {
        overlayLayer.setPosition(e.coordinate);
        popupTextName.innerHTML = `<strong>Názov:</strong> ${feature.get("NAZOV")}`;
        popupTextInfo.innerHTML = `<strong>Priorita:</strong> ${feature.get("PRIORITA") || "Neznámy typ"}`;
      }
    });
  }
});

draw.on("drawend", () => {
  setTimeout(() => {
    filterWFSPoints();
    map.removeInteraction(draw);

  }, 0);
});

removePoly.addEventListener("click", () => {
  map.removeInteraction(draw);
  if (map.getLayers().getArray().includes(drawVectorLayer)) {
    map.removeLayer(drawVectorLayer);
  }
  drawSource.clear();

  if (WFSLayer) {
    map.removeLayer(WFSLayer);
    WFSLayer = null;
  }
});

loadAllWFSPoints(map.getView().getProjection());

// Funkcia skryť sidebar
const wrapper = document.querySelector(".wrapper");
const sidebar = document.querySelector(".sidebar")
const sidebarHideBtn = document.querySelector(".sidebar-hide-btn")
const sidebarHidenBtnIcon = document.querySelector(".sidebar-hide-btn > i")


sidebarHideBtn.addEventListener("click", () => {
  wrapper.classList.toggle("only-map")
  sidebar.classList.toggle("sidebar-hide");
  sidebarHidenBtnIcon.classList.toggle("rotated");
})








