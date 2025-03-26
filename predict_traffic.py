import numpy as np
import pickle
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def predict_congestion(tomtom_data, le_weather, le_event, model, weather='Clear', event='None', time_offsets=[0]):
    try:
        current_speed = tomtom_data['flowSegmentData']['currentSpeed']
        free_flow_speed = tomtom_data['flowSegmentData']['freeFlowSpeed']
        coordinates = tomtom_data['flowSegmentData'].get('coordinates', {})
        road_name = tomtom_data['flowSegmentData'].get('roadName', 'Unknown Road')
    except KeyError as e:
        raise ValueError(f"Missing required field in TomTom data: {str(e)}")

    now = datetime.now()
    day_of_week = now.weekday()
    is_weekend = 1 if day_of_week >= 5 else 0

    try:
        weather_encoded = le_weather.transform([weather])[0]
        event_encoded = le_event.transform([event])[0]
    except ValueError:
        weather_encoded = le_weather.transform(['Clear'])[0]
        event_encoded = le_event.transform(['None'])[0]

    predictions = []
    for offset in time_offsets:
        future_time = now + timedelta(minutes=offset)
        hour = future_time.hour

        # Prepare features for the model
        features = np.array([[current_speed, free_flow_speed, hour, day_of_week,
                              is_weekend, weather_encoded, event_encoded]])

        # Predict congestion level (assuming model outputs a value between 0 and 1)
        congestion_pred = model.predict(features)[0]
        congestion_level = min(max(float(congestion_pred), 0), 1)  # Clamp between 0 and 1

        predictions.append({
            'congestion_level': congestion_level,
            'coordinates': coordinates,
            'timestamp': future_time.isoformat(),
            'current_speed': float(current_speed),
            'free_flow_speed': float(free_flow_speed),
            'time_offset': offset,
            'road_name': road_name
        })

    return predictions

def load_model_and_encoders():
    try:
        with open('traffic_model.pkl', 'rb') as f:
            model = pickle.load(f)
        with open('weather_encoder.pkl', 'rb') as f:
            le_weather = pickle.load(f)
        with open('event_encoder.pkl', 'rb') as f:
            le_event = pickle.load(f)
        return model, le_weather, le_event
    except FileNotFoundError as e:
        raise RuntimeError(f"Model or encoder file not found: {str(e)}")
    except Exception as e:
        raise RuntimeError(f"Error loading model or encoders: {str(e)}")

try:
    model, le_weather, le_event = load_model_and_encoders()
except RuntimeError as e:
    print(f"Failed to start server: {str(e)}")
    exit(1)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    }), 200

@app.route('/predict_congestion', methods=['POST'])
def predict_multiple_congestions():
    try:
        data = request.get_json()
        if not data or 'segments' not in data:
            return jsonify({'error': 'No segments data provided'}), 400

        segments = data['segments']
        weather = data.get('weather', 'Clear')
        event = data.get('event', 'None')
        time_offsets = data.get('time_offsets', [0, 30, 60, 120])

        predictions = []
        for segment in segments:
            try:
                segment_predictions = predict_congestion(segment, le_weather, le_event, model, weather, event, time_offsets)
                predictions.extend(segment_predictions)
            except ValueError as e:
                predictions.append({
                    'error': str(e),
                    'coordinates': segment.get('flowSegmentData', {}).get('coordinates', {}),
                    'time_offset': 0
                })

        return jsonify({
            'predictions': predictions,
            'status': 'success'
        }), 200

    except Exception as e:
        return jsonify({
            'error': f"Server error: {str(e)}",
            'status': 'error'
        }), 500

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=5000)