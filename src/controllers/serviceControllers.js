const { db } = require("../firebase");
const { v4: uuidv4 } = require('uuid');

// Obtener todos los servicios
const getServices = async (req, res) => {
  try {
    const { category, minPrice, maxPrice, search } = req.query;

    let query = db.collection("services");

    if (category) {
      query = query.where("category", "==", category);
    }

    if (minPrice) {
      query = query.where("price", ">=", parseFloat(minPrice));
    }

    if (maxPrice) {
      query = query.where("price", "<=", parseFloat(maxPrice));
    }

    const querySnapshot = await query.get();

    if (querySnapshot.empty) {
      return res.status(404).json({ message: "No se encontraron servicios con los criterios especificados." });
    }

    let services = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (search) {
      const searchLower = search.toLowerCase();
      services = services.filter(
        (service) =>
          service.title.toLowerCase().includes(searchLower) ||
          service.description.toLowerCase().includes(searchLower)
      );
    }

    res.status(200).json(services);
  } catch (error) {
    console.error("Error al obtener servicios:", error.message);
    res.status(500).json({ error: "Error al obtener servicios. Intente nuevamente más tarde." });
  }
};

const createService = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: "El cuerpo de la solicitud está vacío." });
    }

    const { title, price, category, images, description, userId, telefono } = req.body;

    if (!title || !price || !category || !images) {
      return res.status(400).json({
        error: 'Datos incompletos. Se requiere "title", "price", "category" y "images".',
      });
    }

    const id = uuidv4();

    const service = {
      id,
      title,
      price,
      category,
      images,
      description: description || "",
      userId,
      telefono
    };

    await db.collection("services").doc(id).set(service);

    res.status(201).json(service);
  } catch (error) {
    console.error("Error creando servicio:", error.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

const getServiceById = async (req, res) => {
  const { id } = req.params;

  try {
    const serviceDoc = await db.collection("services").doc(id).get();

    if (!serviceDoc.exists) {
      return res.status(404).json({ error: "Servicio no encontrado." });
    }

    res.status(200).json({ id: serviceDoc.id, ...serviceDoc.data() });
  } catch (error) {
    console.error("Error obteniendo servicio por ID:", error.message);
    res.status(500).json({ error: "Error obteniendo servicio por ID." });
  }
};

const updateService = async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    const serviceRef = db.collection("services").doc(id);
    await serviceRef.update(data);

    res.status(200).json({ id, ...data });
  } catch (error) {
    console.error("Error actualizando servicio:", error.message);
    res.status(500).json({ error: "Error actualizando servicio." });
  }
};

const deleteService = async (req, res) => {
  const { id } = req.params;

  try {
    const serviceRef = db.collection("services").doc(id);
    await serviceRef.delete();

    res.status(200).json({ message: "Servicio eliminado con éxito." });
  } catch (error) {
    console.error("Error eliminando servicio:", error.message);
    res.status(500).json({ error: "Error eliminando servicio." });
  }
};

const getServicesByUserId = async (req, res) => {
  const { id } = req.params;

  try {
    const servicesSnapshot = await db
      .collection("services")
      .where("userId", "==", id)
      .get();

    if (servicesSnapshot.empty) {
      return res.status(404).json({ error: "No se encontraron servicios para este usuario." });
    }

    const services = servicesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json(services);
  } catch (error) {
    console.error("Error obteniendo servicios por userId:", error.message);
    res.status(500).json({ error: "Error obteniendo servicios por userId." });
  }
};




// Exportar funciones
module.exports = {
  getServices,
  createService,
  getServiceById,
  updateService,
  deleteService,
  getServicesByUserId
};
