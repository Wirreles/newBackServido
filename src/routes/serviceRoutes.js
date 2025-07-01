const express = require("express");
const {
  getServices,
  createService,
  getServiceById,
  updateService,
  deleteService,
  getServicesByUserId,
} = require("../controllers/serviceControllers");

const router = express.Router();

// Ruta para obtener todos los servicios
router.get("/", getServices);

// Ruta para crear un servicio
router.post("/create", createService);

// Ruta para obtener un servicio por ID
router.get("/:id", getServiceById);

// Ruta para obtener servicios por userId
router.get("/user/:id", getServicesByUserId);

// Ruta para actualizar un servicio
router.put("/:id", updateService);

// Ruta para eliminar un servicio
router.delete("/:id", deleteService);


module.exports = router;
