// const mqtt = require("mqtt");
// const uuid = require("uuid");

import mqtt from "mqtt";
import * as uuid from "uuid";

// MQTT broker connection options
const brokerOptions = {
  clientId: "iot-cart-apis", // Update with your desired client ID
  clean: true,
  // username: "tinker1", // Update with your MQTT broker username
  // password: "1234", // Update with your MQTT broker password
  username: "iot-cart-client", // Update with your MQTT broker username
  password: "cart@`12", // Update with your MQTT broker password
};

// const sqlite3 = require("sqlite3").verbose();
import sqlite3 from "sqlite3";

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
      console.log(`+ Subscribe topic: ${row.code}/barcode`);
      client.subscribe(`${row.code}/barcode`);
      console.log(`+ Subscribe topic: ${row.code}/total`);
      client.subscribe(`${row.code}/total`);
    });
  });
});

import { io } from './socket-io.js';
let socketIo;
io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
  socketIo = socket;
});

client.on("message", async (topic, payload) => {
  const buff = new Buffer.from(payload);
  console.log({ topic, payload, msg: buff.toString() });

  const recCode = buff.toString();
  //   get product id
  const product_id = await getProductIdByCode(recCode);

  const action = topic.split("/")[1];

  if (action != "barcode") {
    return;
  }

  //   get current bill of cart
  const cartCode = topic.split("/")[0];

  const cartId = await getCartId(cartCode);

  let billCode = await getBillCode(cartId);
  console.log(billCode);
  if (!billCode) {
    billCode = uuid.v4();
  }
  const existsItem = await checkIfExistsItem(billCode, product_id);

  let updateBilling;
  if (existsItem) {
    updateBilling = await updateCart(
      existsItem.quantity + 1,
      billCode,
      cartId,
      product_id
    );
  } else {
    updateBilling = await insertCart(billCode, cartId, product_id);
  }

  if (updateBilling == 200) {
    const totalProducts = await getTotalProducts(cartId);
    client.publish(
      topic.split("/")[0] + "/total",
      `Total payment: ${totalProducts.totalPayment}`
    );

    const data = {
      ... totalProducts,
      msg: "update cart",
      code: cartCode
    };

    socketIo.send(data);
  }
});

const getCartId = async (code) => {
  return new Promise((resolve) => {
    db.all("SELECT * FROM cart WHERE code = ?", [code], (err, rows) => {
      if (err) {
        console.error(err);
        return;
      }
      if (rows.length > 0) {
        resolve(rows[0].id);
      } else {
        resolve(null);
      }
      return;
    });
  });
};

const getBillCode = async (cartId) => {
  return new Promise((resolve) => {
    db.all(
      "SELECT * FROM billing WHERE is_current = 1 AND cart_id = ?",
      [cartId],
      (err, rows) => {
        if (err) {
          console.error(err);
          return;
        }
        if (rows.length > 0) {
          resolve(rows[0].code);
        } else {
          resolve(null);
        }
        return;
      }
    );
  });
};

const insertCart = async (billCode, cart_id, product_id) => {
  return new Promise((resolve) => {
    db.run(
      "INSERT INTO billing (code, cart_id, product_id, quantity, is_current) VALUES (?, ?, ?, ?, 1)",
      [billCode, cart_id, product_id, 1],
      function (err) {
        if (err) {
          console.error(err);
          return;
        }
        resolve(200);
        return;
      }
    );
  });
};

const updateCart = async (quantity, billCode, cart_id, product_id) => {
  return new Promise((resolve) => {
    db.run(
      "UPDATE billing SET quantity = ? WHERE code = ? AND cart_id = ? AND product_id = ? AND is_current = 1",
      [quantity, billCode, cart_id, product_id],
      function (err) {
        if (err) {
          console.error(err);
          return;
        }
        resolve(200);
        return;
      }
    );
  });
};

const getProductIdByCode = async (product_code) => {
  return new Promise((resolve, reject) => {
    db.all(
      `
              SELECT *
              FROM products
              WHERE code = ?
          `,
      [product_code],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        if (rows.length > 0) {
          resolve(rows[0].id);
        } else {
          resolve(null);
        }
        return;
      }
    );
  });
};

const getTotalProducts = async (cartId) => {
  return new Promise((resolve, reject) => {
    db.all(
      `
        SELECT billing.code, billing.id, products.code as products_code, products.id as products_id, products.name, billing.quantity, products.price
        FROM billing
        JOIN products ON billing.product_id = products.id
        WHERE billing.cart_id = ? AND billing.is_current = 1
      `,
      [cartId],
      (err, rows) => {
        if (err) {
          console.error(err);
          return;
        }
        let totalPayment = 0;
        if (rows.length > 0) {
          rows.forEach((element) => {
            totalPayment += element.quantity * element.price;
          });
        }
        resolve({ billingDetails: rows, totalPayment });
        return;
      }
    );
  });
};

const checkIfExistsItem = async (billCode, product_id) => {
  return new Promise((resolve) => {
    db.all(
      "SELECT * FROM billing WHERE code = ? AND product_id = ?",
      [billCode, product_id],
      function (err, rows) {
        if (err) {
          console.error(err);
          return;
        }
        if (rows.length > 0) {
          resolve(rows[0]);
        } else {
          resolve(null);
        }
        return;
      }
    );
  });
};

// setTimeout(() => {
//   client.publish("cart/msg", "Hello World!");
// }, 5000);

// export default connection;
