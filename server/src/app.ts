import express, { Application } from "express";
import morgan from 'morgan';


import config from "./config/config";
import prisma from './config/db'


const app: Application = config.getApp();

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }))

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

