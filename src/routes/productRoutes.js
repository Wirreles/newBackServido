const express = require("express");
const {
  getProducts,
  createProduct,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductsByUserId,
  getInactiveProductsByUserId,
  createProductFeature,
  getProductFeatures,
  createProductReview,
  getProductReviews,
  createProductFAQ,
  getProductFAQs,
  updateFAQResponse,
  getDiscountedProducts
} = require("../controllers/productControllers");

const router = express.Router();

// Ruta específica para obtener productos con descuento
router.get("/discounted", getDiscountedProducts);

// Rutas específicas
router.get("/user/:id", getProductsByUserId);
router.get("/user/:userId/inactive", getInactiveProductsByUserId);
router.get("/:productId/features", getProductFeatures);
router.get("/:productId/reviews", getProductReviews);
router.get("/:productId/faqs", getProductFAQs);
router.put("/:productId/faqs/:faqId", updateFAQResponse);

// Rutas generales
router.get("/", getProducts);
router.post("/create", createProduct);
router.get("/:id", getProductById);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);
router.post("/:id/features", createProductFeature);
router.post("/:id/reviews", createProductReview);
router.post("/:id/faqs", createProductFAQ);

module.exports = router;
