# Multi-Field Paddy Crop Monitoring Dashboard

This component extends the crop-health analysis from a single field to multiple paddy fields in Alathur, Kerala.

The system monitors 10 paddy fields using Sentinel-1 SAR observations and converts field-level VH backscatter measurements into crop-stage and health information.

## Workflow

1. Load the 10 paddy field polygons in Google Earth Engine.
2. Retrieve Sentinel-1 SAR imagery.
3. Apply a 30 m focal-median filter to Sentinel-1 VV and VH bands to reduce speckle noise.
4. Extract field-level filtered VH backscatter values for each observation.
5. Build a temporal filtered-VH time series for every field.
6. Determine the latest crop stage from current VH values.
7. Calculate a seasonal VH baseline using historical observations.
8. Compare current VH with the seasonal baseline.
9. Classify each field as Healthy, Moderate, or Low Biomass.
10. Export the resulting field-level attributes for use by the dashboard.

## Field-Level Outputs

Each monitored field contains information such as:

- Field ID
- Latitude
- Longitude
- Current VH value
- Seasonal baseline VH
- Delta VH
- Crop stage
- Health status

## Crop Stage Logic

The current VH value is used to estimate the crop stage:

| VH condition | Crop stage |
|---|---|
| VH < -22 dB | Flooded / Sowing |
| -22 ≤ VH < -18 dB | Early Growth |
| -18 ≤ VH < -15 dB | Vegetative Growth |
| VH ≥ -15 dB | Peak Biomass |

## Health Assessment

Current VH is compared with the seasonal baseline:

| Delta VH | Health status |
|---|---|
| > -0.5 dB | Healthy |
| -2 to -0.5 dB | Moderate |
| ≤ -2 dB | Low Biomass |

## Dashboard

The processed field-level information is served through a Flask web application and displayed through an interactive web interface.

The dashboard provides:

- Field health overview
- Interactive map
- Field-level details
- VH time-series information
- Crop-stage information
- Health classification
- Search and filtering
- Automated data updates

## Live Deployment

The dashboard was deployed as a web application and made accessible through a public deployment.

The application provides an interactive interface for viewing the monitored paddy fields, their current health status, crop stage, and Sentinel-1 observations.

**Dashboard:** https://paddy-dashboard.onrender.com

## Limitations

- Crop-stage and health thresholds are rule-based and are intended for monitoring and decision support rather than formal agronomic diagnosis.
- Health assessment depends on comparison with historical Sentinel-1 observations from the same seasonal period.
- A fallback baseline is used when sufficient historical observations are unavailable.
- The field boundary asset used in Google Earth Engine is not included in this repository.
