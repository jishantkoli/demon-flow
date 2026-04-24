import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { SystemSetting } from '../models/SystemSetting';

export const getSetting = async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.params;
    const setting = await SystemSetting.findOne({ key });
    res.json(setting ? setting.value : null);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

export const updateSetting = async (req: AuthRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Only admin can update settings' });
    }

    const setting = await SystemSetting.findOneAndUpdate(
      { key },
      { value },
      { upsert: true, new: true }
    );

    res.json(setting.value);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
