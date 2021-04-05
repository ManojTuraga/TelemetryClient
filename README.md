# Telemetry Client
Pit-side client software to allow the user to navigate though historical and real time telemetry data from the car

## Use
The root folder needs to have `google_maps_key.py`, `headerKey.json`, and `ku-solar-car-b87af-firebase-adminsdk-ttwuy-0945c0ac44.json`
files with the necessary contents.

## KU Solar Car

## Initial setup
[Link to Medium Article on Deploying](https://medium.com/@dmahugh_70618/deploying-a-flask-app-to-google-app-engine-faa883b5ffab)


[Setup GCloud Terminal](https://cloud.google.com/appengine/docs/standard/python3/setting-up-environment)

Make sure you are in the TelemetryServer Repo in terminal before continuing

1. Once you get GCloud setup on your terminal, make sure you have the correct project by default

`gcloud config set project MY-PROJECT-ID`

In this case 'MY-PROJECT-ID' is ku-solar-car-b87af

2. Make sure your app.yaml file is correct

##### `runtime: python37`

##### `entrypoint: gunicorn -b :8080 main:app`


#### Command to push your changes to GCloud (like git push)
3. Then to deploy
`gcloud app deploy`

Creates the URL: https://ku-solar-car-b87af.appspot.com


#### Interacting with server
4. Post To Server (endpoint is `/car`)

Make sure your POST Request body is in the following format with `timeInSecondsSinceMidnight` being the key to the values of each sensor at said time in seconds.  POST request can take multiple times in seconds at a time.  Make sure values are in the following order as well to ensure correct order of values.

```json

    {
        "battery_voltage": 400,
        "battery_current": 400,
        "battery_temperature": 400,
        "bms_fault": 1,
        "gps_time": 400,
        "gps_lat": 400,
        "gps_lon": 400,
        "gps_velocity_east":400,
        "gps_velocity_north": 400,
        "gps_velocity_up": 400,
        "gps_speed": 400,
        "solar_voltage": 400,
        "solar_current": 400,
        "motor_speed": 400
}

```