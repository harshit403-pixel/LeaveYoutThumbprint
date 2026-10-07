# Leave Your Thumbprint 👆

> One canvas. Infinite thumbprints. One tiny piece of you left behind.

Leave Your Thumbprint is a fun interactive web experiment where anyone can leave their digital thumbprint on a shared infinite canvas.

Pick a name, place your thumbprint, and see how your mark becomes part of a growing collection left by people around the world.

## ✨ What is this?

This project started with a simple idea:

**What if everyone could leave a tiny mark on the same canvas?**

Instead of a traditional guestbook, Leave Your Thumbprint turns every visitor into part of the artwork.

Every thumbprint has its own:

• Name  
• Position  
• Rotation  
• Ink intensity  
• Randomized visual seed  

As more people participate, the canvas keeps growing.

And yes, you can zoom around and discover prints that people have left far away from the main cluster.

## 🎨 Features

### 👆 Leave Your Thumbprint

Enter your name and place your thumbprint anywhere on the canvas.

### 🌎 Shared Infinite Canvas

Every thumbprint is stored and rendered in a shared world space, creating a canvas that can keep expanding as more people participate.

### 🔍 Explore

Pan around the canvas and discover thumbprints left by other people.

### 🎯 Smart Fit

The canvas automatically focuses on the main collection instead of letting a few distant prints force everything to become tiny.

### 🧬 Unique Prints

Each thumbprint gets its own randomized properties, making every mark slightly different.

### 💾 Persistent Prints

Your thumbprint is stored on the backend, so it remains part of the canvas after you leave.

### 📱 Cross Device

The canvas is designed to work across desktop and mobile devices.

## 🛠️ Tech Stack

### Frontend

• Next.js  
• React  
• JavaScript  
• CSS  
• SVG  

### Backend

• Next.js API Routes  
• Database persistence  

## 🧠 How It Works

The canvas uses a world coordinate system rather than positioning prints only relative to the visible screen.

When someone places a thumbprint:

```text
User interaction
      ↓
Screen coordinates
      ↓
World coordinates
      ↓
Collision / position resolution
      ↓
Thumbprint generated
      ↓
POST /api/prints
      ↓
Stored in database
      ↓
Shared with everyone
