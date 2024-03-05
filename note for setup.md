## mqtt server
sudo apt-get update
sudo apt-get install mosquitto

## sample user configuration
sudo mosquitto_passwd -c /etc/mosquitto/passwd mqtt_user_name
Password: mqtt_password

sudo mosquitto_passwd -c /etc/mosquitto/passwd iot-cart-client
password: cart@`12