import pandas as pd # type: ignore
import numpy as np # type: ignore
from sklearn.ensemble import RandomForestRegressor # type: ignore
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import pickle

def load_and_preprocess_data(file_path):
    print(f"Loading data from: {file_path}")
    df = pd.read_csv(file_path)
    print(f"Data shape: {df.shape}")
    print(f"Columns: {df.columns.tolist()}")

    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df['hour'] = df['hour'].astype(int)
    df['day_of_week'] = df['day_of_week'].astype(int)
    df['is_weekend'] = df['is_weekend'].astype(int)
    print(f"Sample timestamp: {df['timestamp'].iloc[0]}")

    le_weather = LabelEncoder()
    le_event = LabelEncoder()

    df['weather'] = df['weather'].fillna('Unknown')
    df['event'] = df['event'].fillna('None')

    weather_values = np.unique(np.append(df['weather'].astype(str).values,
                                      ['Clear', 'Foggy', 'Rainy', 'Stormy', 'Unknown']))
    event_values = np.unique(np.append(df['event'].astype(str).values,
                                     ['None', 'Parade']))

    le_weather.fit(weather_values)
    le_event.fit(event_values)

    df['weather_encoded'] = le_weather.transform(df['weather'])
    df['event_encoded'] = le_event.transform(df['event'])
    print(f"Weather classes: {le_weather.classes_}")
    print(f"Event classes: {le_event.classes_}")

    features = ['current_speed', 'free_flow_speed', 'hour', 'day_of_week',
                'is_weekend', 'weather_encoded', 'event_encoded']
    X = df[features]
    y = df['congestion_level']
    print(f"Feature matrix shape: {X.shape}")
    print(f"Target vector shape: {y.shape}")

    return X, y, le_weather, le_event

def print_accuracy_report(y_true, y_pred, dataset_type="Test"):
    r2 = r2_score(y_true, y_pred)
    mae = mean_absolute_error(y_true, y_pred)
    mse = mean_squared_error(y_true, y_pred)
    rmse = np.sqrt(mse)

    print(f"\n{dataset_type} Set Accuracy Metrics:")
    print(f"R² Score: {r2:.4f}")
    print(f"Mean Absolute Error (MAE): {mae:.4f}")
    print(f"Mean Squared Error (MSE): {mse:.4f}")
    print(f"Root Mean Squared Error (RMSE): {rmse:.4f}")

def train_model(X, y):
    print("Splitting data for training...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    print(f"Training set shape: {X_train.shape}")
    print(f"Test set shape: {X_test.shape}")

    print("Training Random Forest model...")
    rf_model = RandomForestRegressor(n_estimators=100, random_state=42)
    rf_model.fit(X_train, y_train)
    print("Model training completed")

    y_train_pred = rf_model.predict(X_train)
    print_accuracy_report(y_train, y_train_pred, "Training")

    y_test_pred = rf_model.predict(X_test)
    print_accuracy_report(y_test, y_test_pred, "Test")

    print("Saving model to traffic_model.pkl")
    with open('traffic_model.pkl', 'wb') as f:
        pickle.dump(rf_model, f)
    with open('weather_encoder.pkl', 'wb') as f:
        pickle.dump(le_weather, f)
    with open('event_encoder.pkl', 'wb') as f:
        pickle.dump(le_event, f)

    return rf_model

if __name__ == "__main__":
    print("Starting traffic model training...")
    file_path = 'traffic.csv'
    X, y, le_weather, le_event = load_and_preprocess_data(file_path)
    model = train_model(X, y)
    print("Training completed")