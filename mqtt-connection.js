const mqtt = require("mqtt");
// MQTT broker connection options
const brokerOptions = {
  clientId: "iot-cart-apis", // Update with your desired client ID
  clean: true,
  username: "iot-cart-client", // Update with your MQTT broker username
  password: "cart@`12", // Update with your MQTT broker password
};

const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log("Connected to the SQLite database.");
  }
});

// Connect to MQTT broker
const client = mqtt.connect("mqtt://localhost:1883", brokerOptions); // Update with your MQTT broker URL

client.on("connect", () => {
  console.log("Connected");
  db.all("SELECT * FROM cart", (err, rows) => {
    if (err) {
      console.error(err);
      return;
    }
    rows.forEach((row) => {
      console.log(`+ Subscribe topic: ${row.code}`);
      client.subscribe(row.code);
    });
  });
});
client.on("message", (topic, payload) => {
  const buff = new Buffer.from(payload);
  console.log({ topic, payload, msg: buff.toString() });
});

setTimeout(() => {
  client.publish("cart/msg", "Hello World!");
}, 5000);

// export default connection;
