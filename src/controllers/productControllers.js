const { db } = require("../firebase");
const { v4: uuidv4 } = require('uuid');

// Obtener todos los productos
const getProducts = async (req, res) => {
  try {
    // Obtener los parámetros de consulta
    const { category, minPrice, maxPrice, brand, search } = req.query;

    let query = db.collection("products");

    // Aplicar filtros dinámicamente según los parámetros recibidos
    if (category) {
      query = query.where("category", "==", category);
    }

    if (brand) {
      query = query.where("brand", "==", brand);
    }

    if (minPrice) {
      query = query.where("price", ">=", parseFloat(minPrice));
    }

    if (maxPrice) {
      query = query.where("price", "<=", parseFloat(maxPrice));
    }

    const querySnapshot = await query.get();

    if (querySnapshot.empty) {
      console.log("No se encontraron productos con los criterios especificados.");
      return res.status(404).json({ message: "No se encontraron productos con los criterios especificados." });
    }

    let products = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (search) {
      const searchLower = search.toLowerCase();
      products = products.filter(
        (product) =>
          product.title.toLowerCase().includes(searchLower) ||
          product.description.toLowerCase().includes(searchLower)
      );
    }

    res.status(200).json(products);
  } catch (error) {
    console.error("Error al obtener productos:", error.message);
    res.status(500).json({ error: "Error al obtener productos. Intente nuevamente más tarde." });
  }
};


const createProduct = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error("El cuerpo de la solicitud está vacío.");
      return res.status(400).json({ error: "El cuerpo de la solicitud está vacío." });
    }

    const { title, price, category, images, description, stock, brand , userId, isActive } = req.body;

    if (!title || !price || !category || !images) {
      console.error("Datos faltantes:", req.body);
      return res.status(400).json({
        error: 'Datos incompletos. Se requiere "title", "price", "category" y "images".',
      });
    }

    // Generar un ID único para el producto
    const id = uuidv4();

    // Crear el objeto del producto
    const product = {
      id, // Asignar el ID único
      title,
      price,
      category,
      images,
      brand,
      description: description || "",
      stock: stock || 0,
      userId,
      isActive
    };

    // Guardar en Firestore
    const productRef = await db.collection("products").doc(id).set(product);

    res.status(201).json(product);
  } catch (error) {
    console.error("Error creando producto:", error.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

// Obtener un producto por ID
const getProductById = async (req, res) => {
  const { id } = req.params;

  try {
    const productDoc = await db.collection("products").doc(id).get();

    if (!productDoc.exists) {
      return res.status(404).json({ error: "Producto no encontrado." });
    }

    res.status(200).json({ id: productDoc.id, ...productDoc.data() });
  } catch (error) {
    console.error("Error obteniendo producto por ID:", error.message);
    res.status(500).json({ error: "Error obteniendo producto por ID." });
  }
};

// Actualizar un producto
const updateProduct = async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    const productRef = db.collection("products").doc(id);
    await productRef.update(data);

    res.status(200).json({ id, ...data });
  } catch (error) {
    console.error("Error actualizando producto:", error.message);
    res.status(500).json({ error: "Error actualizando producto." });
  }
};

// Eliminar un producto
const deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const productRef = db.collection("products").doc(id);
    await productRef.delete();

    res.status(200).json({ message: "Producto eliminado con éxito." });
  } catch (error) {
    console.error("Error eliminando producto:", error.message);
    res.status(500).json({ error: "Error eliminando producto." });
  }
};

// Obtener productos por userId
const getProductsByUserId = async (req, res) => {
  const { id } = req.params;

  try {
    const productsSnapshot = await db
      .collection("products")
      .where("userId", "==", id)
      .get();

    if (productsSnapshot.empty) {
      return res.status(404).json({ error: "No se encontraron productos para este usuario." });
    }

    const products = productsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json(products);
  } catch (error) {
    console.error("Error obteniendo productos por userId:", error.message);
    res.status(500).json({ error: "Error obteniendo productos por userId." });
  }
};

const checkProductInOrders = async (req, res) => {
  const { id } = req.params;
  try {
    const ordersSnapshot = await db.collection('orders').where('productId', '==', id).get();
    const isLinked = !ordersSnapshot.empty;
    res.status(200).json(isLinked);
  } catch (error) {
    console.error('Error comprobando producto en órdenes:', error.message);
    res.status(500).json({ error: 'Error comprobando producto en órdenes.' });
  }
};

const getInactiveProductsByUserId = async (req, res) => {
  const { userId } = req.params;
  try {
    const productsSnapshot = await db
      .collection("products")
      .where("userId", "==", userId)
      .where("isActive", "==", false)
      .get();

    const products = productsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.status(200).json(products);
  } catch (error) {
    console.error("Error obteniendo productos inactivos:", error.message);
    res.status(500).json({ error: "Error obteniendo productos inactivos." });
  }
};

const createProductFeature = async (req, res) => {
  // console.log("Body recibido:", req.body);

  try {
    const { productId, feature } = req.body;

    if (!productId || !feature || !feature.label || !feature.value) {
      return res.status(400).json({ error: "Faltan datos para crear la característica." });
    }

    const featureId = uuidv4(); // Generar un ID único para la característica

    const featureData = {
      id: featureId,
      label: feature.label,
      value: feature.value,
    };

    // Referencia a la subcolección 'features' del producto
    const productRef = db.collection("products").doc(productId);
    await productRef.collection("features").doc(featureId).set(featureData);

    res.status(201).json({ message: "Característica creada exitosamente.", feature: featureData });
  } catch (error) {
    console.error("Error al crear característica:", error.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

const getProductFeatures = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ error: "El ID del producto es requerido." });
    }

    const productRef = db.collection("products").doc(productId);
    const featuresSnapshot = await productRef.collection("features").get();

    if (featuresSnapshot.empty) {
      return res.status(404).json({ error: "No se encontraron características para este producto." });
    }

    const features = featuresSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json(features);
  } catch (error) {
    console.error("Error al obtener características:", error.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

const createProductReview = async (req, res) => {
  try {
    const { productId, review } = req.body;

    if (
      !productId || 
      !review || 
      !review.userId || 
      !review.rating || 
      !review.comment
    ) {
      return res.status(400).json({ error: "Faltan datos para crear la reseña." });
    }

    const reviewId = uuidv4(); // Generar un ID único para la reseña

    const reviewData = {
      id: reviewId,
      userId: review.userId,
      rating: review.rating,
      comment: review.comment,
      // createdAt: new Date().toISOString(), 
    };

    // Referencia a la subcolección 'reviews' del producto
    const productRef = db.collection("products").doc(productId);
    await productRef.collection("reviews").doc(reviewId).set(reviewData);

    res.status(201).json({ message: "Reseña creada exitosamente.", review: reviewData });
  } catch (error) {
    console.error("Error al crear reseña:", error.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ error: "El ID del producto es requerido." });
    }

    const productRef = db.collection("products").doc(productId);
    const reviewsSnapshot = await productRef.collection("reviews").get();

    if (reviewsSnapshot.empty) {
      return res.status(404).json({ error: "No se encontraron reseñas para este producto." });
    }

    const reviews = reviewsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json(reviews);
  } catch (error) {
    console.error("Error al obtener reseñas:", error.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

// Crear una pregunta frecuente
const createProductFAQ = async (req, res) => {
  try {
    const { productId, question } = req.body;
    console.log("Datos recibidos en el backend:", { productId, question });

    if (!productId || !question || !question.userId || !question.text) {
      return res.status(400).json({ error: "Faltan datos para crear la pregunta frecuente." });
    }

    const faqId = uuidv4(); // Generar un ID único para la pregunta

    const faqData = {
      id: faqId,
      productId: question.productId,
      userId: question.userId,
      text: question.text,
      answer: null, // La respuesta será null inicialmente
    };

    // Referencia a la subcolección 'faqs' del producto
    const productRef = db.collection("products").doc(productId);
    await productRef.collection("faqs").doc(faqId).set(faqData);

    res.status(201).json({ message: "Pregunta frecuente creada exitosamente.", faq: faqData });
  } catch (error) {
    console.error("Error al crear pregunta frecuente:", error.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

// Obtener las preguntas frecuentes de un producto
const getProductFAQs = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId) {
      return res.status(400).json({ error: "El ID del producto es requerido." });
    }

    const productRef = db.collection("products").doc(productId);
    const faqsSnapshot = await productRef.collection("faqs").get();

    if (faqsSnapshot.empty) {
      return res.status(404).json({ error: "No se encontraron preguntas frecuentes para este producto." });
    }

    const faqs = faqsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json(faqs);
  } catch (error) {
    console.error("Error al obtener preguntas frecuentes:", error.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

// Actualizar la respuesta de una pregunta frecuente
const updateFAQResponse = async (req, res) => {
  try {
    const { productId, faqId } = req.params;
    const { answer } = req.body;

    if (!productId || !faqId || !answer) {
      return res.status(400).json({ error: "Faltan datos para actualizar la respuesta." });
    }

    // Referencia a la pregunta frecuente en la subcolección 'faqs' del producto
    const faqRef = db.collection("products").doc(productId).collection("faqs").doc(faqId);

    // Verificar si la pregunta frecuente existe
    const faqDoc = await faqRef.get();
    if (!faqDoc.exists) {
      return res.status(404).json({ error: "No se encontró la pregunta frecuente." });
    }

    // Actualizar la respuesta
    await faqRef.update({
      answer
    });

    res.status(200).json({ message: "Respuesta actualizada exitosamente." });
  } catch (error) {
    console.error("Error al actualizar la respuesta:", error.message);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

const getDiscountedProducts = async (req, res) => {
  try {
    const productsSnapshot = await db
      .collection("products")
      .where("discount", ">", 0)
      .get();

    if (productsSnapshot.empty) {
      return res.status(404).json({ error: "No se encontraron productos con descuento." });
    }

    const discountedProducts = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json(discountedProducts);
  } catch (error) {
    res.status(500).json({ error: "Error obteniendo productos con descuento." });
  }
};





// Exportar funciones
module.exports = {
  getProducts,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductsByUserId,
  getInactiveProductsByUserId,
  checkProductInOrders,
  createProductFeature,
  getProductFeatures,
  createProductReview,
  getProductReviews,
  createProductFAQ,
  getProductFAQs,
  updateFAQResponse,
  getDiscountedProducts
};
