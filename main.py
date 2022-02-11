#!/usr/bin/env python3

import os
import sys

import json
from collections import OrderedDict

from threading import Timer
from datetime import datetime, timedelta
from time import time

from random import randint, choices  # For generating test data
import numpy as np  # For downsampling

import firebase_admin
from firebase_admin import credentials, firestore
from flask import Flask, render_template, jsonify, request
from google.cloud import error_reporting

# each key is just a string variable
from secrets import keys

MAX_POINTS = 500  # Downsample data to this many points if there are more
BUFFER_TIME = 60.0  # Send data every 60 seconds.

CLIENT_FORMAT_FILE = "client_format.json"
DATABASE_FORMAT_FILE = "database_format.json"
DATABASE_COLLECTION = "telemetry"

FIREBASE_SERVICE_ACCT_FILE = "secrets/ku-solar-car-b87af-firebase-adminsdk-ttwuy-0945c0ac44.json"

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "secrets/ku-solar-car-b87af-eccda8dd87e0.json"
reporting_client = error_reporting.Client()

cred = credentials.Certificate(FIREBASE_SERVICE_ACCT_FILE)
firebase_admin.initialize_app(cred, {"projectId": "ku-solar-car-b87af"})

db = firestore.client()
COL_TELEMETRY = db.collection('telemetry')
buffer = dict()
lastRead = dict()

app = Flask(__name__, static_url_path='/static')

SENSORS = ["battery_current", "battery_temperature", "battery_voltage", "bms_fault", "gps_course", "gps_dt", "gps_lat",
           "gps_lon", "gps_speed", "motor_speed", "solar_current", "solar_voltage"]

NAV_LIST = ["realtime", "daily", "longterm"]

# Determines what each tab/graph should display
with open(CLIENT_FORMAT_FILE) as file_handle:
    client_format = json.load(file_handle)

# Specifies information about each sensor in the database
with open(DATABASE_FORMAT_FILE) as file_handle:
    db_format = json.load(file_handle)


def writeToFireBase():
    """
    This function will write to Firebase with the given buffer.
    """
    timestampStr = datetime.now().strftime("%Y-%m-%d")

    try:
        collections = getOrderedCollections(timestampStr)
        for col, sensor in zip(collections, SENSORS):
            for sec in buffer.keys():
                if sensor in buffer[sec]:
                    data_per_timeframe = buffer[sec][sensor]
                    col.document("0").update({
                        str(sec): data_per_timeframe
                    })
        buffer.clear()
        print("Buffer clear")
    except Exception as e:
        reporting_client.report_exception()

        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno)
        print(e)


countdownToBufferClear = Timer(BUFFER_TIME, writeToFireBase)


def create(doc_datetime):
    """
        create() : Add document to Firestore collection with request body
        Ensure you pass a custom ID as part of json body in post request
        e.g. json={'id': '1', 'title': 'Write a blog post'}
    """
    timestampStr = doc_datetime.strftime("%Y-%m-%d")

    if not COL_TELEMETRY.document(timestampStr).get().exists:
        try:
            COL_TELEMETRY.document(timestampStr).set({"Date": timestampStr})
            for sensor in SENSORS:
                COL_TELEMETRY.document(timestampStr).collection(sensor).document("0").set({})
            return "Documents Created", 201
        except Exception as e:
            reporting_client.report_exception()
            return f"An Error Occured: {e}", 400
    return "Document already exists", 200


@app.route('/car', methods=['POST'])
def fromCar():
    # Make sure the data source is legit.
    if request.headers['Authentication'] != keys.transmitter_authentication:
        return f"An Error Occured: Authentication Failed", 401

    # Start over buffer timer clear.
    global countdownToBufferClear
    if not countdownToBufferClear.is_alive():
        countdownToBufferClear = Timer(BUFFER_TIME, writeToFireBase)
        countdownToBufferClear.start()

    req_body = request.get_json()

    # If gps sent date and time, convert it to timestamp to add as a field.
    if 'gps_date' in req_body and 'gps_time' in req_body:
        raw_date = req_body['gps_date']  # Format ddmmyy.
        raw_time = req_body['gps_time'][0:6]  # Format hhmmsscc.
        req_body['gps_dt'] = datetime.strptime(raw_date + raw_time, '%d%m%y%H%M%S')
    else:
        req_body['gps_dt'] = datetime.fromtimestamp(0)

    label_dt = datetime.now()

    sec_of_day = round((label_dt - label_dt.replace(hour=0, minute=0, second=0, microsecond=0)).total_seconds())
    print(sec_of_day)

    timestampStr = label_dt.strftime("%Y-%m-%d")
    if not COL_TELEMETRY.document(timestampStr).get().exists:
        create(label_dt)
    collections = getOrderedCollections(timestampStr)

    try:
        buffer[sec_of_day] = {}
        lastRead["timestamp"] = int(time())
        for col, sensor in zip(collections, SENSORS):
            if sensor in req_body.keys():
                buffer[sec_of_day][sensor] = req_body[sensor]
                lastRead[sensor] = req_body[sensor]
        if len(buffer) > (15*12):  # Check buffer size and if it is greater than threshold.
            writeToFireBase()
            countdownToBufferClear.cancel()
            buffer.clear()
            return "Success, buffer limit reached but data uploaded, buffer cleared", 202
        return "Success, data added to buffer", 202
    except Exception as e:
        reporting_client.report_exception()

        countdownToBufferClear.cancel()
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(exc_type, fname, exc_tb.tb_lineno)
        return f"An Error Occured: {e}", 400


@app.route('/get/<date>', methods=['GET'])
def read(date):
    """
        read : Fetches documents from Firestore collection as JSON
        todo : Return document that matches query ID
        all_todos : Return all documents
    """
    # dateFormat = "%Y-%m-%d"
    try:
        if not COL_TELEMETRY.document(date).get().exists:
            return "Document for specified date does not exist", 404
        data = dict()
        collections = COL_TELEMETRY.document(date).collections()
        for col in collections:
            for doc in col.stream():
                data[str(col.id)] = doc.to_dict()
        return jsonify(data), 200
    except Exception as e:
        reporting_client.report_exception()
        return f"An Error Occured: {e}", 404


@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')


def getOrderedCollections(timestampStr):
    return sorted(list(COL_TELEMETRY.document(timestampStr).collections()), key=lambda x: x.id)

### Realtime ##################################################################

@app.route('/realtime', methods=['GET'])
def realtime():
    nav_list = NAV_LIST
    nav = "realtime"
    no_chart_keys = {  # Some info never needs to be graphed. Pass it as dict for JSON serialization.
        'keys': ["gps_dt",
                 "gps_course",
                 "gps_lon",
                 "gps_lat",
                 "gps_velocity_east",
                 "gps_velocity_north",
                 "gps_velocity_up"]}

    return render_template('realtime.html',
                           nav_list=nav_list,
                           nav=nav,
                           maps_url=keys.google_maps_key,
						   mapbox_key=keys.mapbox_key,
                           format=db_format,
                           no_chart=no_chart_keys)


# Get real data to display on the realtime page
@app.route("/realtime/data", methods=["GET"])
def recentData():
    """
    Return the most recent data set that was sent from the car
    """
    try:
        data = dict()
        for sensor in lastRead.keys():
            data[sensor] = lastRead[sensor]
        return jsonify(data), 200
    except Exception as e:
        reporting_client.report_exception()
        return f"An Error Occured: {e}", 404


# Get random test data to display on the realtime page
@app.route('/realtime/dummy', methods=['GET'])
def data():
    return jsonify(battery_voltage=randint(0, 5),
                   battery_current=randint(15, 30),
                   battery_temperature=randint(80, 120),
                   bms_fault=choices([0, 1], weights=[.9, .1])[0],
                   gps_time=int(time()),
				   timestamp=int(time()), # seconds since epoch
                   gps_lat=None,
                   gps_lon=None,
                   gps_velocity_east=None,
                   gps_velocity_north=None,
                   gps_velocity_up=None,
                   gps_speed=None,
                   solar_voltage=randint(0, 5),
                   solar_current=randint(15, 30),
                   motor_speed=randint(15, 30))


### Daily #####################################################################

@app.route('/daily', methods=['GET'])
def daily():
    nav_list = NAV_LIST
    list_of_days = [day.id for day in db.collection(DATABASE_COLLECTION).stream()]
    # Check if valid date was provided as GET parameter, default to today (at midnight) if not
    #try:
        #date = datetime.strptime(request.args.get('date', default=""), '%Y-%m-%d')
    #except ValueError:
        #date = datetime.combine(datetime.today(), datetime.min.time())

    try:
        date = datetime.strptime(request.args.get('date', default=""), '%Y-%m-%d')
    except ValueError or IndexError:
        date = datetime.strptime(list_of_days[-1], '%Y-%m-%d')

    # Formatted date strings when rendering page and buttons to other dates
    #date_str = date.strftime('%Y-%m-%d')
    #prev_date_str = (date-timedelta(days=1)).strftime('%Y-%m-%d')
    #next_date_str = (date+timedelta(days=1)).strftime('%Y-%m-%d')
    date_str = date.strftime('%Y-%m-%d')

    for day in list_of_days:
        if date_str <= day:
            prev_date_str = list_of_days[list_of_days.index(day)-1]
            next_date_str = list_of_days[(list_of_days.index(day)+1)%len(list_of_days)]
            break

    else:
        prev_date_str = list_of_days[-1]
        next_date_str = list_of_days[0]

    tab_list = client_format.keys()

    # Check if valid tab was provided as GET parameter, default to default to first tab if not
    try:
        tab = request.args.get('tab')
        if not tab in client_format.keys(): raise ValueError()
    except ValueError:
        tab = next(iter(client_format))

    graph_data = OrderedDict()  # The data used in the render template (see format below)

    if tab == "Location":  # Location tab uses separate template to display map
        # URL to initialize Google Maps API, to be injected into HTML. Key: value is from local google_maps_key.py file.
        maps_url = keys.google_maps_key

        # Check if valid times were provided as GET parameter, default to all day if not
        try:
            # Times are represented by seconds from midnight
            starttime = int(request.args.get('starttime', default=''))
            endtime = int(request.args.get('endtime', default=''))
        except ValueError:
            starttime = 0
            endtime = 86400

        # Get list of latitudes. lat_gen is a generator of document snapshots, but will only yield one snapshot for us
        # given the firebase setup.
        lat_gen = db.collection(DATABASE_COLLECTION).document(date_str).collection('gps_lat').stream()

        # Avoid a server error if there's no data for the day (lat_gen yields no values)
        try:
            lat_reading_dict = next(lat_gen).to_dict() # dict format: {'second': reading}, ex. {'10': 334}
        except StopIteration:
            location_pairs = None
            return render_template('daily_location.html', **locals())

        lat_reading_list = \
            sorted({int(k): v for k, v in lat_reading_dict.items() if starttime <= int(k) <= endtime}.items())
        sec_list, lat_list = zip(*lat_reading_list)

        # Get list of longitudes in the same manner
        lon_gen = db.collection(DATABASE_COLLECTION).document(date_str).collection('gps_lon').stream()

        try:
            lon_reading_dict = next(lon_gen).to_dict()
        except StopIteration:
            location_pairs = None
            return render_template('daily_location.html', **locals())

        lon_reading_list = \
            sorted({int(k): v for k, v in lon_reading_dict.items() if starttime <= int(k) <= endtime}.items())
        sec_list, lon_list = zip(*lon_reading_list)

        location_pairs = list(zip(lat_list, lon_list))  # [(lat0, lon0), (lat1, lon1), ...]

        return render_template('daily_location.html', **locals())
    else:
        # Loop through every sensor the current tab should show a reading for
        #print(client_format[tab]["lines"])
        for sensor_id in client_format[tab]["lines"]:
            # Find the info about the sensor
            if sensor_id not in db_format: continue
            sensor = db_format[sensor_id]
            #print(sensor, sensor_id)

            # Ensure the sensor is in the database
            if sensor is not None and "name" in sensor.keys():
                graph_data[sensor["name"]] = OrderedDict()

                # Loop through all the sensor readings for the day being viewed
##              db_data = db.collection(DATABASE_COLLECTION).document(date_str).collection(sensor_id).stream()


                # Creates dictionary with all the data within the specific sensor_id, will be a NoneType of the date_str is not in the database
                db_data = db.collection(DATABASE_COLLECTION).document(date_str).collection(sensor_id).document("0").get().to_dict()
                #list_of_days = [day.id for day in db.collection(DATABASE_COLLECTION).stream()]
                
##                try:
##                    readings = next(db_data).to_dict()["seconds"] # The map within the sensor's document
##
##                    readings 
##                except StopIteration:
##                    continue  # Skip sensors not in database
##                except KeyError:
##                    continue

                # Convert keys from strings to ints and sort (conversion required for sort to be correct)

##              sorted_readings = sorted({int(k) : v for k, v in readings.items()}.items())

                #Tries to sort the entries, checks if there is a NoneType. If so, will assign empty lists to times and readings
                try:
                    sorted_readings = sorted({int(k) : v for k, v in db_data.items()}.items())

                    # Convert the sorted list of tuples into two separate lists using zip
                    times, readings = zip(*sorted_readings)

                except AttributeError:
                    times, readings = [], []

                except ValueError:
                    times, readings = [], []

                #times, readings = zip(*sorted_readings)

                # Downsample data if needed
                if len(readings) > MAX_POINTS:
                    times, readings = avg_downsample(np.array(times), np.array(readings), MAX_POINTS)

                for time, reading in zip(times, readings):
                    unix = int(date.timestamp() + time)*1000
                    graph_data[sensor["name"]][unix] = reading

        return render_template('daily.html', **locals())


# https://stackoverflow.com/questions/10847660/subsampling-averaging-over-a-numpy-array
def avg_downsample(x, y, num_bins):
    pts_per_bin = x.size // num_bins
    end = pts_per_bin * int(len(y)/pts_per_bin)
    x_avgs = np.mean(x[:end].reshape(-1, pts_per_bin), 1)
    y_avgs = np.mean(y[:end].reshape(-1, pts_per_bin), 1)
    y_avgs = np.round(y_avgs, 2)
    return x_avgs, y_avgs


# A different downsampling method. This is currently not being used, but left as an option for the future
# https://stackoverflow.com/questions/54449631/improve-min-max-downsampling
def min_max_downsample(x, y, num_bins):
    pts_per_bin = x.size // num_bins

    x_view = x[:pts_per_bin*num_bins].reshape(num_bins, pts_per_bin)
    y_view = y[:pts_per_bin*num_bins].reshape(num_bins, pts_per_bin)
    i_min = np.argmin(y_view, axis=1)
    i_max = np.argmax(y_view, axis=1)

    r_index = np.repeat(np.arange(num_bins), 2)
    c_index = np.sort(np.stack((i_min, i_max), axis=1)).ravel()

    return x_view[r_index, c_index], y_view[r_index, c_index]


# Generate a day of fake data and store in Firebase for testing
@app.route('/generate-dummy-data', methods=['GET'])
def dummy():
    try:
        # Check if valid date was provided as GET parameter
        date = datetime.strptime(request.args.get('date', default=""), '%Y-%m-%d')
    except ValueError:
        return "Invalid or missing date GET parameter"

    # Ensure day does not have any (possibly real) data already (the exception is the goal)
    date_str = date.strftime('%Y-%m-%d')
    db_data = db.collection(DATABASE_COLLECTION).where("date", "==", date_str).stream()
    try:
        readings = next(db_data)
        return "Date already has data"
    except StopIteration:  # This means its safe to generate data (without overwriting)
        pass

    test_sensors = \
        {"battery_voltage": [300, 400], "battery_current": [200, 500], "bms_fault": [0, 1], "battery_level": [60, 70]}
    date_doc = db.collection(DATABASE_COLLECTION).document(date_str)

    for sensor, rand_range in test_sensors.items():
        dummy_data = {"seconds": {}}
        for i in range(0, 86400, 5):
            dummy_data["seconds"][str(i)] = randint(rand_range[0], rand_range[1])
        date_doc.collection(sensor).document("0").set(dummy_data, merge=True)

    return "OK"


### Longterm ##################################################################

@app.route('/longterm', methods=['GET'])
def longterm():
    nav_list = NAV_LIST
    nav = "longterm"
    return render_template('longterm.html', **locals())


if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)
