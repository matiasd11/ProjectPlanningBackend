const express = require('express');
const { models } = require('../models');
const { User, Task } = models;

const router = express.Router();

// 📝 PUT - Voluntario toma una tarea
router.put('/:taskId/take', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { ongId } = req.body;

    if (!ongId) {
      return res.status(400).json({
        success: false,
        message: 'ongId es requerido'
      });
    }

    const task = await Task.findByPk(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Tarea no encontrada'
      });
    }

    if (task.takenBy) {
      return res.status(400).json({
        success: false,
        message: 'Esta tarea ya está tomada por otra ONG'
      });
    }

    const ong = await User.findByPk(ongId);
    if (!ong) {
      return res.status(404).json({
        success: false,
        message: 'ONG no encontrada'
      });
    }

    await task.update({ 
      takenBy: ongId,
      status: 'in_progress'
    });

    const updatedTask = await Task.findByPk(taskId, {
      include: [
        {
          model: User,
          as: 'volunteer',
          attributes: ['id', 'username', 'organizationName', 'email']
        }
      ]
    });

    res.json({
      success: true,
      message: `${ong.organizationName} se hará cargo de la tarea`,
      data: updatedTask
    });

  } catch (error) {
    console.error('Error taking task:', error);
    res.status(500).json({
      success: false,
      message: 'Error asignándose a la tarea'
    });
  }
});

module.exports = router;