# Alathur Paddy Crop-Health Analysis

This analysis was carried out for a paddy field in Alathur, Kerala, using Google Earth Engine and multi-sensor satellite observations.

## Data

The analysis used:

- Sentinel-2 Surface Reflectance imagery
- Sentinel-1 SAR imagery
- Google Earth Engine

The Sentinel-2 analysis covered 22 May 2025 to 17 October 2025.

## Sentinel-2 Processing

The Sentinel-2 workflow included:

1. Filtering imagery to the Alathur study area.
2. Filtering by acquisition date.
3. Applying an SCL-based cloud and scene classification mask.
4. Calculating NDVI.
5. Calculating NDWI.
6. Creating a quality mosaic using maximum NDVI.
7. Producing a peak vegetation-health image.

### Indices

NDVI was calculated using:

`(B8 - B4) / (B8 + B4)`

NDWI was calculated using:

`(B3 - B8) / (B3 + B8)`

## Vegetation Classification

The peak NDVI image was divided into three vegetation-health classes:

| NDVI range | Class |
|---|---|
| NDVI < 0.35 | Low Vegetation |
| 0.35 ≤ NDVI < 0.45 | Moderate Vegetation |
| NDVI ≥ 0.45 | Healthy Vegetation |

The resulting classification was used to calculate the percentage of the study area represented by each class.

The original analysis reported approximately:

- **85% Healthy Vegetation**
- **15% Moderate Vegetation**
- **0% Low Vegetation**

## Temporal Analysis

Mean NDVI and NDWI were extracted for each available Sentinel-2 observation to generate temporal profiles for the study area.

These time series were used to understand changes in vegetation condition and moisture-related signals through the crop season.

## Sentinel-1 SAR Analysis

Sentinel-1 GRD imagery was also analysed for the same study area and period.

The workflow extracted mean VV backscatter for the field through time.

The SAR time series was used to complement optical observations during periods affected by cloud cover and to interpret patterns associated with flooding and crop development.

## Interpretation

The analysis demonstrates how optical vegetation indices and SAR backscatter can be combined for crop monitoring.

Sentinel-2 provided vegetation and moisture-related information through NDVI and NDWI, while Sentinel-1 provided radar observations that could continue to support monitoring when optical observations were affected by cloud cover.
