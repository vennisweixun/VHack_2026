###### **Where to upload your new model**

Your API loads the model from a .pkl file. The path is controlled by MODEL\_PATH in your .env file.



**Step 1** — Run fraud\_model\_pipeline.py to retrain



cd "C:\\Users\\Vennis\\OneDrive\\Desktop\\VhACK"

python fraud\_model\_pipeline.py

This produces a new fraud\_model.pkl.



**Step 2** — Patch the pkl (adds label encoders + frequency maps)



python patch\_pkl.py

This patches the .pkl in-place so the API can use it without crashing.



**Step 3** — Place the file and update .env



Copy your new .pkl to wherever you like (e.g. the fraud-api folder), then open fraud-api/.env and set:



MODEL\_PATH=C:\\Users\\Vennis\\OneDrive\\Desktop\\VhACK\\fraud-api\\fraud\_model.pkl

The default path in config.py is C:\\FraudShield\\fraud\_model.pkl — so if you don't update .env, it looks there.



**Step 4** — Restart the API



cd "C:\\Users\\Vennis\\OneDrive\\Desktop\\VhACK\\fraud-api"

uvicorn app.main:app --reload



The API will pick up the new model on startup and log something like:

XGBoost model loaded: 35 features, encoders=yes





*If you have a .pkl from an entirely new training run (e.g. different feature columns), also run patch\_pkl.py on it — it adds the label\_encoders and freq\_maps keys that the API requires. If the pkl is missing those keys, the API falls back to zero-encoding which degrades prediction quality.*

