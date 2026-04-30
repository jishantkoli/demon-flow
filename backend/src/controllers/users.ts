import { Request, Response } from 'express';
import { User } from '../models/User.js';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth.js';

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.query;
    const query: any = {};
    if (role) query.role = role;
    
    const users = await User.find(query).sort({ createdAt: -1 });
    res.status(200).json(users.map(u => ({
      ...u.toObject(),
      id: u._id
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { action, users } = req.body;

    if (action === 'bulk-import' && Array.isArray(users)) {
      const usersToCreate = await Promise.all(users.map(async (u: any) => {
        const password = u.password_hash || Math.random().toString(36).slice(-8);
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        return {
          email: u.email,
          passwordHash,
          role: u.role || 'teacher',
          profile: {
            fullName: u.name || 'User',
            phone: u.phone || '',
            schoolName: u.school_name || '',
            district: u.district || ''
          },
          isActive: true
        };
      }));
      const created = await User.insertMany(usersToCreate);
      return res.status(201).json({ success: true, count: created.length });
    }

    const { name, email, password_hash, role, phone, school_name, district, status } = req.body;
    
    // Check if user exists
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password_hash || 'School@123', salt);

    const user = await User.create({
      profile: { 
        fullName: name || 'User',
        phone,
        schoolName: school_name,
        district
      },
      email,
      passwordHash,
      role,
      isActive: status !== 'inactive'
    });

    res.status(201).json({ ...user.toObject(), id: user._id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id, password_hash, name, phone, school_name, district, status, ...otherUpdates } = req.body;
    
    const updates: any = { ...otherUpdates };

    if (password_hash) {
      const salt = await bcrypt.genSalt(10);
      updates.passwordHash = await bcrypt.hash(password_hash, salt);
    }

    if (name || phone || school_name || district) {
      const user = await User.findById(id);
      if (user) {
        updates.profile = {
          fullName: name || user.profile.fullName,
          phone: phone !== undefined ? phone : user.profile.phone,
          schoolName: school_name !== undefined ? school_name : user.profile.schoolName,
          district: district !== undefined ? district : user.profile.district,
        };
      }
    }

    if (status !== undefined) {
      updates.isActive = status !== 'inactive';
    }

    const user = await User.findByIdAndUpdate(id, updates, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.status(200).json({ ...user.toObject(), id: user._id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.body;
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
