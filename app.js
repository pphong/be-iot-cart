// const express = require("express");
import express from "express";
// const bodyParser = require("body-parser");
import bodyParser from "body-parser";
// const sqlite3 = require("sqlite3").verbose();
import sqlite3 from "sqlite3";
// const cors = require("cors");
import cors from "cors";

import mqtt from "mqtt";

import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// Connect to SQLite database
const db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log("Connected to the SQLite database.");
  }
});

// Create products table
db.run(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    code TEXT,
    name TEXT,
    category TEXT,
    quantity INTEGER,
    price REAL
  )
`);

// Create cart table
db.run(`
  CREATE TABLE IF NOT EXISTS cart (
    id INTEGER PRIMARY KEY,
    code TEXT,
    name TEXT
  )
`);

// Create billing table
db.run(`
  CREATE TABLE IF NOT EXISTS billing (
    id INTEGER PRIMARY KEY,
    code TEXT,
    cart_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    is_current TINYINT,
    member_id INTEGER
  )
`);

// Create user table
db.run(`
  CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY,
    email TEXT,
    role TEXT,
    password TEXT,
    avatar_url TEXT
  )
`);

// Create member table
db.run(`
  CREATE TABLE IF NOT EXISTS member (
    id INTEGER PRIMARY KEY,
    code TEXT,
    point INTEGER
  )
`);

const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) {
    return res.status(403).json({ message: "Token is required" });
  }
  const _token = token.split(" ")[1];
  jwt.verify(_token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.userId = decoded.userId;
    next();
  });
};

// Get all products
app.get("/products", verifyToken, (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  db.all("SELECT * FROM products", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ products: rows });
  });
});

// Add a new product
app.post("/products", verifyToken, (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const { code, name, category, quantity, price } = req.body;
  db.run(
    "INSERT INTO products (code, name, category, quantity, price) VALUES (?, ?, ?, ?, ?)",
    [code, name, category, quantity, price],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: "Product added successfully", id: this.lastID });
    }
  );
});

// Update a product
app.put("/products/:id", verifyToken, (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const { code, name, category, quantity, price } = req.body;
  const id = req.params.id;
  db.run(
    "UPDATE products SET code = ?, name = ?, category = ?, quantity = ?, price = ? WHERE id = ?",
    [code, name, category, quantity, price, id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        message: "Product updated successfully",
        changes: this.changes,
      });
    }
  );
});

// Delete a product
app.delete("/products/:id", verifyToken, (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const id = req.params.id;
  db.run("DELETE FROM products WHERE id = ?", [id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({
      message: "Product deleted successfully",
      changes: this.changes,
    });
  });
});

// Add a product to the cart
app.post("/cart", verifyToken, (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const { id, code, name } = req.body;
  db.run(
    "INSERT INTO cart (id, code, name) VALUES (?, ?, ?)",
    [id, code, name],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        message: "Product added to cart successfully",
        id: this.lastID,
      });
    }
  );
});

// Get all items in the cart
app.get("/cart", verifyToken, (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  db.all("SELECT * FROM cart", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ cart: rows });
  });
});

// Get all items in the cart
app.get("/cart/:code", verifyToken, (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const { code } = req.params;
  db.all("SELECT * FROM cart WHERE code = ?", [code], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ cart: rows });
  });
});

// Update a cart
app.put("/cart/:id", verifyToken, (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const { name } = req.body;
  const id = req.params.id;
  db.run("UPDATE cart SET name = ? WHERE id = ?", [name, id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({
      message: "Cart updated successfully",
      changes: this.changes,
    });
  });
});

// Delete a cart
app.delete("/cart/:id", verifyToken, (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const id = req.params.id;
  db.run("DELETE FROM cart WHERE id = ?", [id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({
      message: "Cart deleted successfully",
      changes: this.changes,
    });
  });
});

// Billing

// Get all billing entries
app.get("/billing", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  db.all("SELECT * FROM billing", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ billing: rows });
  });
});

// Get billing details joined with product and cart
app.get("/billing/:id", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const cart_id = req.params.id;
  db.all(
    `
      SELECT billing.code, billing.id, products.code as products_code, products.id as products_id, products.name, billing.quantity, products.price
      FROM billing
      JOIN products ON billing.product_id = products.id
      WHERE billing.cart_id = ? AND billing.is_current = 1
    `,
    [cart_id],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      let totalPayment = 0;
      rows.forEach((element) => {
        totalPayment += element.quantity * element.price;
      });
      res.json({ billingDetails: rows, totalPayment });
    }
  );
});

// Add a new billing entry
app.post("/billing", async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const { code, cart_id, is_current, product_code } = req.body;
  let { quantity, product_id } = req.body;
  if (product_code) {
    product_id = await getProductIdByCode(req);
    if (!product_id) {
      res.status(404).json({
        message: `Your selected product (${product_code}) is not available!`,
      });
      return;
    }
  }

  let inputData = {
    code,
    cart_id,
    is_current,
    product_code,
    quantity,
    product_id,
  };

  const inStock = await checkIfInStock(inputData);
  if (inStock < 0) {
    res.json({
      message: `This item is out of stock! Please select available quantity: ${
        Number(quantity) + Number(inStock)
      }`,
    });
    return;
  }
  const checkBeforeInsert = await checkIfExists(inputData);
  if (checkBeforeInsert == -1) {
    await db.run(
      "INSERT INTO billing (code, cart_id, product_id, quantity, is_current) VALUES (?, ?, ?, ?, ?)",
      [code, cart_id, product_id, quantity, is_current],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({
          message: "Billing entry added successfully",
          id: this.lastID,
        });
      }
    );
  } else {
    const sumQuantity = Number(quantity) + Number(checkBeforeInsert);
    await db.run(
      "UPDATE billing SET quantity = ? WHERE code = ? AND cart_id = ? AND product_id = ? AND is_current = 1",
      [sumQuantity, code, cart_id, product_id],
      function (err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({
          message: "Billing entry updated successfully",
          changes: this.changes,
        });
      }
    );
  }

  const { billingDetails, cart_code, totalPayment } = await getBillTotal(code);
  client.publish(`${cart_code}/total`, `Total payment: ${totalPayment}`);
});

const checkIfExists = async (input) => {
  const { code, cart_id, product_id, quantity } = input;
  const rows = await new Promise((resolve, reject) => {
    db.all(
      `
        SELECT *
        FROM billing
        WHERE billing.code = ? AND billing.cart_id = ? AND billing.is_current = 1 AND billing.product_id = ?
    `,
      [code, cart_id, product_id],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      }
    );
  });
  return rows[0]?.quantity ?? -1;
};

const checkIfInStock = async (input) => {
  const { product_id, quantity } = input;
  const rows = await new Promise((resolve, reject) => {
    db.all(
      `
          SELECT *
          FROM products
          WHERE id = ?
      `,
      [product_id],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      }
    );
  });
  return rows[0]?.quantity - quantity;
};

const getProductIdByCode = async (req) => {
  const { product_code } = req.body;
  const rows = await new Promise((resolve, reject) => {
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
        resolve(rows);
      }
    );
  });
  return rows[0]?.id;
};

// Update a billing entry
app.put("/billing/:id", async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const { code, cart_id, product_id, quantity } = req.body;
  await db.run(
    "UPDATE billing SET quantity = ? WHERE code = ? AND cart_id = ? AND product_id = ? AND is_current = 1",
    [quantity, code, cart_id, product_id],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      res.json({
        message: "Billing entry updated successfully",
        changes: this.changes,
      });
    }
  );

  const { billingDetails, cart_code, totalPayment } = await getBillTotal(code);
  client.publish(`${cart_code}/total`, `Total payment: ${totalPayment}`);
});

// Delete a billing entry
app.delete("/billing/:id", async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const id = req.params.id;
  db.run(
    "UPDATE billing SET is_current = 0 WHERE id = ?",
    [id],
    async function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }

      res.json({
        message: "Billing entry deleted successfully",
        changes: this.changes,
      });
    }
  );

  const { billingDetails, cart_code, totalPayment } = await getBillTotal(
    id,
    true
  );

  client.publish(`${cart_code}/total`, `Total payment: ${totalPayment}`);
});

// Complete payment request
app.patch("/billing/:code", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const code = req.params.code;
  db.run(
    "UPDATE billing SET is_current = 0 WHERE code = ?",
    [code],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({
        message: "Billing payment success!",
        changes: this.changes,
      });
    }
  );
});

// const mqtt = require("mqtt");

// MQTT broker connection options
const brokerOptions = {
  clientId: "iot-cart-apis-1", // Update with your desired client ID
  clean: true,
  username: "tinker1", // Update with your MQTT broker username
  password: "1234", // Update with your MQTT broker password
};

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

app.post("/billing-total", async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const cart_id = req.body.cart_id;

  const { billingDetails, cart_code, totalPayment } = await getCartTotal(
    cart_id
  );
  res.json({ billingDetails, totalPayment });
  client.publish(
    `${cart_code}/total`,
    `Your purchase has been successful - Total payment: ${totalPayment}`
  );
});

const getCartTotal = async (cart_id) => {
  return new Promise((resolve, reject) => {
    db.all(
      `
        SELECT billing.code, billing.id, products.code as products_code, products.id as products_id, products.name, billing.quantity, products.price, cart.code as cart_code
        FROM billing
        JOIN products ON billing.product_id = products.id
        JOIN cart ON billing.cart_id = cart.id
        WHERE billing.cart_id = ? AND billing.is_current = 1
      `,
      [cart_id],
      (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        let totalPayment = 0;
        rows.forEach((element) => {
          totalPayment += element.quantity * element.price;
        });
        const cart_code = rows[0]?.cart_code;
        resolve({ billingDetails: rows, cart_code, totalPayment });
      }
    );
  });
};

const getBillTotal = async (billing_code, getBillingCode = false) => {
  let billCode;
  if (getBillingCode) {
    billCode = await (() => {
      return new Promise((resolve, reject) => {
        db.all(
          `
            SELECT * FROM billing WHERE id = ?
          `,
          [billing_code],
          (err, rows) => {
            if (rows.length > 0) {
              resolve(rows[0].code);
            } else {
              resolve(null);
            }
            return;
          }
        );
      });
    })();
  }
  return new Promise((resolve, reject) => {
    db.all(
      `
        SELECT billing.code, billing.id, products.code as products_code, products.id as products_id, products.name, billing.quantity, products.price, cart.code as cart_code
        FROM billing
        JOIN products ON billing.product_id = products.id
        JOIN cart ON billing.cart_id = cart.id
        WHERE billing.code = ? AND billing.is_current = 1
      `,
      [billCode ?? billing_code],
      (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }

        let totalPayment = 0;
        rows.forEach((element) => {
          totalPayment += element.quantity * element.price;
        });
        const cart_code = rows[0]?.cart_code;
        resolve({ billingDetails: rows, cart_code, totalPayment });
      }
    );
  });
};

/**
 * CRUD user
 */
const secretKey = "your_secret_key"; // Change this with your actual secret key
const saltRounds = 10;

// Create a new user
app.post("/users", (req, res) => {
  const { email, role, password, avatar_url } = req.body;
  db.run(
    "INSERT INTO user (email, role, password, avatar_url) VALUES (?, ?, ?, ?)",
    [email, role, password, avatar_url],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({
        id: this.lastID,
        email,
        role,
        password,
        avatar_url,
      });
    }
  );
});

// Get all users
app.get("/users", (req, res) => {
  db.all("SELECT * FROM user", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ users: rows });
  });
});

// Get user by ID
app.get("/users/:id", (req, res) => {
  const id = req.params.id;
  db.get("SELECT * FROM user WHERE id = ?", [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ user: row });
  });
});

// Update user by ID
app.put("/users/:id", (req, res) => {
  const id = req.params.id;
  const { email, role, avatar_url } = req.body;
  db.run(
    "UPDATE user SET email = ?, role = ?, avatar_url = ? WHERE id = ?",
    [email, role, avatar_url, id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({
        message: "User updated successfully",
        changes: this.changes,
      });
    }
  );
});

// Update password user by ID
app.patch("/users/:id", (req, res) => {
  const id = req.params.id;
  const { password } = req.body;
  bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    db.run("UPDATE user SET password = ? WHERE id = ?", [hash, id], function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "Password changed successfully" });
    });
  });
});

// Delete user by ID
app.delete("/users/:id", (req, res) => {
  const id = req.params.id;
  db.run("DELETE FROM user WHERE id = ?", id, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  });
});

// Register a new user
app.post("/register", (req, res) => {
  const { email, role, password, avatar_url } = req.body;
  bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    db.run(
      "INSERT INTO user (email, role, password, avatar_url) VALUES (?, ?, ?, ?)",
      [email, role, hash, avatar_url],
      function (err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({
          id: this.lastID,
          email,
          role,
          avatar_url,
        });
      }
    );
  });
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  db.get("SELECT * FROM user WHERE email = ?", [email], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    bcrypt.compare(password, row.password, (err, result) => {
      if (err || !result) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const token = jwt.sign({ id: row.id, email: row.email }, secretKey);
      res.json({ message: "Login successful", token });
    });
  });
});

// Logout
app.get("/logout", verifyToken, (req, res) => {
  // Here you can implement logout logic if needed
  res.json({ message: "Logout successful" });
});

app.use(cors()); // Add this line
app.use(bodyParser.json());
app.options("*", cors());

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
