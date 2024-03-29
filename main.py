import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
app = Flask(__name__)
CORS(app, supports_credentials=True)



pickled_model = pickle.load(open("pcos_predict.pkl", "rb"))

@app.route("/")
def hello_world():
    return "<p>Hello, World!</p>"



@app.route("/predict-pcos", methods=["POST"])
def predict_pcos():
    try:
        input_data = request.json  # Get input data from the POST request
        prediction = pickled_model.predict([list(input_data.values())])  # Make prediction using the loaded model
        return jsonify({"prediction": int(prediction[0])})  # Return prediction as a JSON response
    except Exception as e:
        return jsonify({"error": str(e)}), 400  # Handle errors
    

if __name__ == "__main__":
    app.run(port=8000)