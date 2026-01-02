import { NextRequest } from 'next/server';
import { ResponseUtil } from '@/common/utils/response.util';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { mongoPrisma } from '@/common/mongo.service';
import { ApiError } from '@/common/errors/api.error';
import { z } from 'zod';

const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().optional(),
});

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export class AuthController {
    static async register(req: Request) {
        try {
            const body = await req.json();
            const { email, password, name } = RegisterSchema.parse(body);

            const existingUser = await mongoPrisma.user.findUnique({ where: { email } });
            if (existingUser) {
                throw ApiError.conflict('User already exists');
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const user = await mongoPrisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name,
                },
            });

            // Auto-login (generate token)
            const token = jwt.sign(
                { userId: user.id, email: user.email },
                process.env.JWT_SECRET || 'secret',
                { expiresIn: '7d' }
            );

            return Response.json({ user: { id: user.id, email: user.email, name: user.name }, token });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                return Response.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
            }
            return ResponseUtil.handleError(error);
        }
    }

    static async login(req: Request) {
        try {
            const body = await req.json();
            const { email, password } = LoginSchema.parse(body);

            const user = await mongoPrisma.user.findUnique({ where: { email } });
            if (!user || !user.password) {
                throw ApiError.unauthorized('Invalid email or password');
            }

            const valid = await bcrypt.compare(password, user.password);
            console.log(`[LOGIN DEBUG] Checking password for ${email}`);
            console.log(`[LOGIN DEBUG] Match Result: ${valid}`);

            if (!valid) {
                console.log(`[LOGIN ERROR] Password mismatch for ${email}`);
                throw ApiError.unauthorized('Invalid email or password');
            }

            const token = jwt.sign(
                { userId: user.id, email: user.email },
                process.env.JWT_SECRET || 'secret',
                { expiresIn: '7d' }
            );

            return Response.json({ user: { id: user.id, email: user.email, name: user.name }, token });
        } catch (error: any) {
            if (error instanceof z.ZodError) {
                return Response.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
            }
            return ResponseUtil.handleError(error);
        }
    }
}
