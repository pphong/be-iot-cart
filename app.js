const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

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
    is_current TINYINT
  )
`);

// Get all products
app.get("/products", (req, res) => {
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
app.post("/products", (req, res) => {
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
app.put("/products/:id", (req, res) => {
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
app.delete("/products/:id", (req, res) => {
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
app.post("/cart", (req, res) => {
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
app.get("/cart", (req, res) => {
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
app.get("/cart/:code", (req, res) => {
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
app.put("/cart/:id", (req, res) => {
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
app.delete("/cart/:id", (req, res) => {
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
    db.run(
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
    quantity += checkBeforeInsert;
    db.run(
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
  }
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
app.put("/billing/:id", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const { code, cart_id, product_id, quantity, is_current } = req.body;
  const id = req.params.id;
  db.run(
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
});

// Delete a billing entry
app.delete("/billing/:id", (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  const id = req.params.id;
  db.run("DELETE FROM billing WHERE id = ?", [id], function (err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({
      message: "Billing entry deleted successfully",
      changes: this.changes,
    });
  });
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
  });
});

app.use(cors()); // Add this line
app.use(bodyParser.json());
app.options("*", cors());

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
