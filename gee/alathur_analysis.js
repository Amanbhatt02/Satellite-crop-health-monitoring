// Alathur Paddy Field — Crop Health Analysis
// Internship project: Satellite-Based Crop Health Monitoring
// Google Earth Engine

// NOTE:
// The 'geometry' variable is the Alathur study-area polygon
// imported separately in the original Google Earth Engine script.

Map.centerObject(geometry, 16);
Map.addLayer(geometry, {color: 'white'}, 'Study Area (Alathur)');


// --------------------------------------------------
// SENTINEL-2: CLOUD MASKING AND SPECTRAL INDICES
// --------------------------------------------------

function maskS2clouds(image) {
  var scl = image.select('SCL');
  var mask = scl.eq(4).or(scl.eq(5)).or(scl.eq(6));
  return image.updateMask(mask);
}

function addIndices(img) {
  var ndvi = img.normalizedDifference(['B8', 'B4']).rename('NDVI');
  var ndwi = img.normalizedDifference(['B3', 'B8']).rename('NDWI');
  return img.addBands([ndvi, ndwi]);
}

var s2_collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(geometry)
  .filterDate('2025-05-22', '2025-10-17')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 70))
  .map(maskS2clouds)
  .map(addIndices);

print('Total raw images:', s2_collection.size());


// --------------------------------------------------
// PEAK VEGETATION HEALTH
// --------------------------------------------------

var peak_health_image = s2_collection
  .qualityMosaic('NDVI')
  .clip(geometry);

var ndvi_peak = peak_health_image.select('NDVI');
var ndwi_peak = peak_health_image.select('NDWI');

Map.addLayer(
  ndvi_peak,
  {min: 0.2, max: 0.6, palette: ['red', 'yellow', 'green']},
  'Peak NDVI (Quality Mosaic)'
);

Map.addLayer(
  ndwi_peak,
  {min: -0.6, max: 0.0, palette: ['#8c510a', '#d8b365', '#f6e8c3']},
  'Peak NDWI (Quality Mosaic)'
);

var trueColor = peak_health_image.select(['B4', 'B3', 'B2']);

Map.addLayer(
  trueColor,
  {min: 0, max: 3000},
  'True Color (Peak Health)'
);


// --------------------------------------------------
// NDVI / NDWI TIME SERIES
// --------------------------------------------------

var index_ts = s2_collection.map(function(img) {

  var meanValues = img.select(['NDVI', 'NDWI']).reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e9
  });

  return img.set({
    date: img.date().format('YYYY-MM-dd'),
    mean_NDVI: meanValues.get('NDVI'),
    mean_NDWI: meanValues.get('NDWI')
  });
});

var index_fc = ee.FeatureCollection(index_ts)
  .filter(ee.Filter.notNull(['mean_NDVI']));

var ndviChart = ui.Chart.feature.byFeature({
  features: index_fc,
  xProperty: 'date',
  yProperties: ['mean_NDVI']
})
.setChartType('LineChart')
.setOptions({
  title: 'NDVI Time Series',
  hAxis: {title: 'Date'},
  vAxis: {title: 'Mean NDVI'},
  lineWidth: 2,
  pointSize: 5,
  colors: ['green']
});

print(ndviChart);

var ndwiChart = ui.Chart.feature.byFeature({
  features: index_fc,
  xProperty: 'date',
  yProperties: ['mean_NDWI']
})
.setChartType('LineChart')
.setOptions({
  title: 'NDWI Time Series',
  hAxis: {title: 'Date'},
  vAxis: {title: 'Mean NDWI'},
  lineWidth: 2,
  pointSize: 5,
  colors: ['blue']
});

print(ndwiChart);


// --------------------------------------------------
// NDVI HEALTH CLASSIFICATION
// --------------------------------------------------

var ndvi_class = ndvi_peak.expression(
  "(NDVI < 0.35) ? 1" +
  ": (NDVI < 0.45) ? 2" +
  ": 3",
  {'NDVI': ndvi_peak}
)
.updateMask(ndvi_peak.mask())
.clip(geometry);

Map.addLayer(
  ndvi_class,
  {min: 1, max: 3, palette: ['red', 'yellow', 'green']},
  'Peak NDVI Classification'
);


// --------------------------------------------------
// AREA DISTRIBUTION
// --------------------------------------------------

var areaImage = ee.Image.pixelArea().addBands(ndvi_class);

var stats = areaImage.reduceRegion({
  reducer: ee.Reducer.sum().group({
    groupField: 1,
    groupName: 'class'
  }),
  geometry: geometry,
  scale: 10,
  maxPixels: 1e9
});

var groups = ee.List(stats.get('groups'));

var classKeys = groups.map(function(item) {
  return ee.Number(
    ee.Dictionary(item).get('class')
  ).format('%d');
});

var classValues = groups.map(function(item) {
  return ee.Dictionary(item).get('sum');
});

var areaDict = ee.Dictionary.fromLists(
  classKeys,
  classValues
);

var totalArea = ee.Number(
  classValues.reduce(ee.Reducer.sum())
);

var classList = ee.List([1, 2, 3]);

var percentages = classList.map(function(classNum) {

  var classStr = ee.Number(classNum).format('%d');

  var area = ee.Algorithms.If(
    areaDict.contains(classStr),
    areaDict.get(classStr),
    0
  );

  var className = ee.Algorithms.If(
    ee.Number(classNum).eq(1),
    'Low Veg',
    ee.Algorithms.If(
      ee.Number(classNum).eq(2),
      'Moderate Veg',
      'Healthy Veg'
    )
  );

  var percent = ee.Number(area)
    .divide(totalArea)
    .multiply(100);

  return ee.Feature(null, {
    'Class': className,
    'Percentage': percent
  });
});

var fc_pie = ee.FeatureCollection(percentages);

var pieChart = ui.Chart.feature.byFeature({
  features: fc_pie,
  xProperty: 'Class',
  yProperties: ['Percentage']
})
.setChartType('PieChart')
.setOptions({
  title: 'Peak Vegetation Health Distribution',
  colors: ['red', 'yellow', 'green']
});

print(pieChart);


// --------------------------------------------------
// SENTINEL-1 SAR TIME SERIES
// --------------------------------------------------

var s1_collection = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(geometry)
  .filterDate('2025-05-22', '2025-10-17')
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(
    ee.Filter.listContains(
      'transmitterReceiverPolarisation',
      'VV'
    )
  )
  .filter(
    ee.Filter.eq(
      'orbitProperties_pass',
      'DESCENDING'
    )
  );

print(
  s1_collection.aggregate_array('platform_number')
);

var s1c_only = s1_collection.filter(
  ee.Filter.eq('platform_number', 'C')
);

print(
  'Number of Sentinel-1C images:',
  s1c_only.size()
);


// --------------------------------------------------
// SENTINEL-1 VV TIME SERIES
// --------------------------------------------------

var s1_ts = s1_collection.map(function(img) {

  var meanDict = img.select('VV').reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e9
  });

  return img.set({
    'date': img.date().format('YYYY-MM-dd'),
    'mean_VV': meanDict.get('VV')
  });
});

var s1_fc = ee.FeatureCollection(s1_ts)
  .filter(ee.Filter.notNull(['mean_VV']));

var sarChart = ui.Chart.feature.byFeature({
  features: s1_fc,
  xProperty: 'date',
  yProperties: ['mean_VV']
})
.setChartType('LineChart')
.setOptions({
  title: 'Sentinel-1 SAR Time Series (Tracking Flooding & Growth)',
  hAxis: {title: 'Date'},
  vAxis: {title: 'Mean VV Backscatter (dB)'},
  lineWidth: 2,
  pointSize: 5,
  colors: ['purple']
});

print(sarChart);
