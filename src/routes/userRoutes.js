const express = require("express");
const {
  getUserById,
  updateUser,
} = require("../controllers/userController");

const router = express.Router();

// Ruta para obtener todos los servicios
router.get("/:id", getUserById);

// Ruta para actualizar un usuario por ID
router.put("/:id", updateUser);

module.exports = router;
