import express from "express";


const router = express.Router();

router.get("/", (req,res)=> res.send("ASEGURATE API OK"));
router.get("/prueba", (req, res) => {
  res.send("FUNCIONA");
});


export default router;
