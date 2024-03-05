const mqtt = require("mqtt");
// MQTT broker connection options
const brokerOptions = {
  clientId: "iot-cart-apis-2", // Update with your desired client ID
  clean: true,
  username: "iot-cart-client", // Update with your MQTT broker username
  password: "cart@`12", // Update with your MQTT broker password
};

// Connect to MQTT broker
const client = mqtt.connect("mqtt://localhost:1883", brokerOptions); // Update with your MQTT broker URL

client.on("connect", () => {
  console.log("Connected");
  main();
});

client.on("message", (topic, payload) => {
  const buff = new Buffer.from(payload);
  console.log({ topic, payload, msg: buff.toString() });
});

const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to prompt user for input
function promptForInput(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

let data = {};

async function main() {
  while (true) {
    data.topic = await promptForInput("Enter topic: ");
    data.msg = await promptForInput("Enter msg: ");
    client.publish(data.topic, data.msg);
    console.log("----------------");
  }
}
