// Multi-Field Paddy Crop Monitoring
// Internship project: Satellite-Based Crop Health Monitoring
// Google Earth Engine

var paddyFields = ee.FeatureCollection(
  "users/amanbhatt/alathur_paddy_fields"
);

Map.centerObject(paddyFields, 15);

Map.addLayer(
  paddyFields,
  {color: 'red'},
  'Paddy Fields'
);



// SENTINEL-1 DATA


var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(paddyFields)
  .filterDate('2023-01-01', ee.Date(Date.now()))
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .select(['VV', 'VH']);

print('Sentinel-1 collection:', s1);
print('Total images:', s1.size());



// SPECKLE FILTERING


var s1_filtered = s1.map(function(image) {

  var vv = image.select('VV')
    .focal_median(30, 'circle', 'meters');

  var vh = image.select('VH')
    .focal_median(30, 'circle', 'meters');

  return image
    .addBands(vv.rename('VV_filtered'), null, true)
    .addBands(vh.rename('VH_filtered'), null, true)
    .copyProperties(image, ['system:time_start']);

});

print('Speckle filtered collection:', s1_filtered);



// ASSIGN FIELD IDs


var paddyFields = paddyFields.map(function(feature) {
  return feature.set('field_id', feature.id());
});



// FIELD-LEVEL VH TIME SERIES


var vh_timeseries = s1_filtered.map(function(image) {

  var stats = image.select('VH').reduceRegions({
    collection: paddyFields,
    reducer: ee.Reducer.mean(),
    scale: 10
  });

  return stats.map(function(feature) {

    return feature.set({
      'date': image.date().format('YYYY-MM-dd'),
      'system_time': image.get('system:time_start'),
      'VH': feature.get('mean')
    });

  });

}).flatten();

print('VH Time Series Table', vh_timeseries);



// VH TIME SERIES CHART


var chart = ui.Chart.feature.groups({
  features: vh_timeseries,
  xProperty: 'system_time',
  yProperty: 'VH',
  seriesProperty: 'field_id'
})
.setChartType('LineChart')
.setOptions({
  title: 'Sentinel-1 VH Time Series for Paddy Fields (Alathur)',
  hAxis: {
    title: 'Date'
  },
  vAxis: {
    title: 'VH Backscatter (dB)'
  },
  lineWidth: 2,
  pointSize: 3,
  legend: {
    position: 'right'
  }
});

print(chart);



// LATEST SENTINEL-1 OBSERVATION


var latestImage = s1_filtered
  .sort('system:time_start', false)
  .first();

print(
  'Latest Sentinel-1 date',
  latestImage.date()
);



// CURRENT CROP STAGE


var currentFields = latestImage.select('VH').reduceRegions({
  collection: paddyFields,
  reducer: ee.Reducer.mean(),
  scale: 10
});

var classifiedFields = currentFields.map(function(feature) {

  var vh = ee.Number(feature.get('mean'));

  var stage = ee.Algorithms.If(
    vh.lt(-22),
    'Flooded / Sowing',
    ee.Algorithms.If(
      vh.lt(-18),
      'Early Growth',
      ee.Algorithms.If(
        vh.lt(-15),
        'Vegetative Growth',
        'Peak Biomass'
      )
    )
  );

  return feature.set({
    'VH_value': vh,
    'crop_stage': stage
  });

});

print(
  'Current Crop Stage per Field',
  classifiedFields
);



// SEASONAL BASELINE


var latestDate = ee.Date(
  latestImage.get('system:time_start')
);

var latestYear = latestDate.get('year');
var doy = latestDate.getRelative('day', 'year');

print('Latest observation date', latestDate);
print('Day of year', doy);


// Previous three years
var startYear = ee.Number(latestYear).subtract(3);
var endYear = ee.Number(latestYear).subtract(1);

var historical = s1.filter(
  ee.Filter.calendarRange(
    startYear,
    endYear,
    'year'
  )
);


// ±7 days around the same day of year
var seasonalCollection = historical.filter(
  ee.Filter.calendarRange(
    ee.Number(doy).subtract(7),
    ee.Number(doy).add(7),
    'day_of_year'
  )
);

print(
  'Seasonal comparison images',
  seasonalCollection
);


// Seasonal median VH per field
var baselineSeasonal = seasonalCollection
  .select('VH')
  .median()
  .reduceRegions({
    collection: paddyFields,
    reducer: ee.Reducer.mean(),
    scale: 10
  });

print(
  'Seasonal baseline VH',
  baselineSeasonal
);



// HEALTH CLASSIFICATION


var healthFields = classifiedFields.map(function(feature) {

  var fieldID = feature.get('field_id');

  var baselineFeature = baselineSeasonal
    .filter(
      ee.Filter.eq(
        'field_id',
        fieldID
      )
    )
    .first();

  var baselineVH = ee.Algorithms.If(
    baselineFeature,
    ee.Number(
      ee.Feature(baselineFeature).get('mean')
    ),
    -18
  );

  var currentVH = ee.Number(
    feature.get('VH_value')
  );

  var deltaVH = currentVH.subtract(
    ee.Number(baselineVH)
  );

  var health = ee.Algorithms.If(
    deltaVH.gt(-0.5),
    'Healthy',
    ee.Algorithms.If(
      deltaVH.gt(-2),
      'Moderate',
      'Low Biomass'
    )
  );

  return feature.set({
    'baseline_VH': baselineVH,
    'delta_VH': deltaVH,
    'health_status': health
  });

});



// CROP HEALTH MAP


var styledFields = healthFields.map(function(feature) {

  var health = feature.get('health_status');

  var color = ee.Algorithms.If(
    ee.String(health)
      .compareTo('Healthy')
      .eq(0),
    '00FF00',
    ee.Algorithms.If(
      ee.String(health)
        .compareTo('Moderate')
        .eq(0),
      'FFFF00',
      'FF0000'
    )
  );

  return feature.set({
    style: {
      color: 'black',
      width: 1,
      fillColor: color
    }
  });

});

Map.addLayer(
  styledFields.style({
    styleProperty: 'style'
  }),
  {},
  'Crop Health Map'
);



// ADD FIELD COORDINATES AND EXPORT


var exportFields = healthFields.map(function(feature) {

  var centroid = feature.geometry().centroid();
  var coords = centroid.coordinates();

  var lon = coords.get(0);
  var lat = coords.get(1);

  return feature.set({
    longitude: lon,
    latitude: lat
  });

});

print(
  'Fields for Export',
  exportFields
);

Export.table.toAsset({
  collection: exportFields,
  description: 'alathur_paddy_health',
  assetId: 'users/amanbhatt/alathur_paddy_health'
});
