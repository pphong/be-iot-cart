// const mqtt = require("mqtt");
import mqtt from "mqtt";
// MQTT broker connection options
const brokerOptions = {
  clientId: "tinker", // Update with your desired client ID
  clean: true,
  username: "1976d606-b12c-4ae6-bf09-e7af5ab46c5d", // Update with your MQTT broker username
  password: "1976d606-b12c-4ae6-bf09-e7af5ab46c5d", // Update with your MQTT broker password
};

// Connect to MQTT broker
const client = mqtt.connect("mqtt://mqtt1.eoh.io:1883", brokerOptions); // Update with your MQTT broker URL

client.on("connect", () => {
  console.log("Connected");
  main();
});

client.on("error", (error) => {
    console.error(error);
})

client.on("message", (topic, payload) => {
  const buff = new Buffer.from(payload);
  console.log({ topic, payload, msg: buff.toString() });
});

// const readline = require("readline");
import readline from 'readline';

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

/**
 * user auth-token
 * pass auth-token
 * Call back ERA with topic /eoh/chip/<auth-token>/
 * 
 * update widget value by trigger config/<widget-id>/value
 */