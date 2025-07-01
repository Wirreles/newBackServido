const { db } = require("../firebase");
const { v4: uuidv4 } = require('uuid');


// Obtener un producto por ID
const getUserById = async (req, res) => {
    const { id } = req.params;
  
    try {
      const userDoc = await db.collection("usuarios").doc(id).get();
  
      if (!userDoc.exists) {
        return res.status(404).json({ error: "Usuario no encontrado." });
      }
  
      res.status(200).json({ id: userDoc.id, ...userDoc.data() });
    } catch (error) {
      console.error("Error obteniendo Usuario por ID:", error.message);
      res.status(500).json({ error: "Error obteniendo Usuario por ID." });
    }
  };

  const updateUser = async (req, res) => {
    const { id } = req.params;
    const userData = req.body;
  
    try {
      await db.collection("usuarios").doc(id).update(userData);
      res.status(200).json({ message: "Usuario actualizado correctamente." });
    } catch (error) {
      console.error("Error actualizando usuario:", error.message);
      res.status(500).json({ error: "Error actualizando usuario." });
    }
  };
  
// Exportar funciones
module.exports = {
    getUserById,
    updateUser,
  };