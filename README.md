# Telemetry Client
Pit-side client software to allow the user to navigate though historical and real time telemetry data from the car. Maintains an internal buffer of recent data and archives to Firebase Cloud Firestore. Developed using Flask and designed to be deployed to Google Cloud App Engine.

## Setup and deployment
Automated build deployment is enabled for the `master` branch, so pushing to `master` deploys the code to production. _Exception_: If the `oursecrets` folder is changed you have to run local deployment to see those changes on the server. Follow the instructions below to push from your local.

If adding non-vcs files (i.e. files specified in .gitignore), you probably want to add them to .gcloudignore.

### Prerequisites
The root folder needs to have `ourSecrets/__init__.py`, `ourSecrets/keys.py`, `ourSecrets/ku-solar-car-b87af-eccda8dd87e0.json`, and `ourSecrets/ku-solar-car-b87af-firebase-adminsdk-ttwuy-0945c0ac44.json`
files with the necessary contents. You can download them from Slack.

### Google Cloud setup
[Link to Medium article on deploying](https://medium.com/@dmahugh_70618/deploying-a-flask-app-to-google-app-engine-faa883b5ffab)

[Setup GCloud Terminal](https://cloud.google.com/appengine/docs/standard/python3/setting-up-environment) (click "Install and Initialize the Cloud SDK" to download)

Make sure you are in the TelemetryServer repository in your terminal before continuing

1. Once you get GCloud setup on your terminal, make sure you have the correct project by default:

`gcloud config set project ku-solar-car-b87af`

2. Make sure your app.yaml file is correct:

```YAML
runtime: python37
entrypoint: gunicorn -b :8080 main:app
```

### Google Cloud deployment (like git push)
3. Run the following command to deploy. This takes a few minutes.
`gcloud app deploy`

Publishes the application the URL (`gcloud app browse`): https://ku-solar-car-b87af.appspot.com

### Interacting with server
4. Post To Server (endpoint is `/car`)

Data will come from [TelemetrySource](https://github.com/KU-Solar-Car/TelemetrySource). To send test the server, make a POST request with the body in the following format:

```json

    {
        "battery_voltage": 400,
        "battery_current": 400,
        "battery_temperature": 400,
        "bms_fault": 1,
        "gps_time": 400,
        "gps_lat": 400,
        "gps_lon": 400,
        "gps_speed": 400,
        "solar_voltage": 400,
        "solar_current": 400,
        "motor_speed": 400
}

```

### Note: Temporary build files

Deploying to Google Cloud creates \[an absured amount of\] temporary files in the Google Cloud Storage bucket `us.artifacts.ku-solar-car-b87af.appspot.com`. These can be deleted from Google Cloud Console and set up to automatically expire to avoid going over the free tier storage limit (1 GB). 

## Troubleshooting

The application can be run on a development machine by running app.py with Python 3. In the Google Cloud Console, the Logs Explorer allows you to view console output, including exceptions, similar to running what you get running the application locally.
