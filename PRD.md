# Product Requirements Document (PRD)

# GOR Booking Management System (MVP)

Version: 1.0

---

# 1. Project Overview

## Deskripsi

GOR Booking Management System adalah aplikasi berbasis web yang digunakan untuk melakukan reservasi penggunaan GOR secara online.

Pada tahap MVP, sistem hanya mengelola **1 GOR dengan 1 lapangan multifungsi**.

Lapangan tersebut dapat digunakan untuk beberapa cabang olahraga:

* Futsal
* Badminton
* Basket
* Volley

Karena hanya terdapat satu lapangan, maka **dalam satu waktu hanya boleh terdapat satu booking aktif**, terlepas dari jenis olahraga yang dipilih.

Contoh:

08.00 - 10.00 digunakan untuk Futsal.

Maka pada jam tersebut tidak dapat dilakukan booking Basket, Badminton, maupun Volley.

---

# 2. Tujuan Sistem

Sistem dibangun untuk:

* Mempermudah pelanggan melakukan reservasi GOR.
* Menghindari bentrok jadwal penggunaan lapangan.
* Mempermudah admin mengelola seluruh reservasi.
* Menyediakan informasi jadwal penggunaan lapangan secara real-time.

---

# 3. Target Pengguna

## Customer

Hak akses:

* Registrasi akun
* Login
* Melihat jadwal lapangan
* Melakukan booking
* Melihat riwayat booking
* Mengubah profil

---

## Administrator

Hak akses:

* Login
* Melihat seluruh booking
* Mengelola booking
* Mengelola data pengguna
* Mengakses dashboard statistik

---

# 4. Ruang Lingkup MVP

Fitur yang akan dikembangkan pada versi pertama:

* Authentication
* Dashboard Customer
* Dashboard Admin
* Booking Lapangan
* Jadwal Booking
* Riwayat Booking
* Profil User

Belum termasuk:

* Payment Gateway
* QRIS
* WhatsApp Notification
* Email Notification
* Multi GOR
* Multi Lapangan
* Membership
* Promo
* Voucher
* Laporan Keuangan

---

# 5. Informasi GOR

## Lapangan

Jumlah lapangan:

1

Jenis:

Lapangan Multifungsi

Olahraga yang didukung:

* Futsal
* Basket
* Volley
* Badminton

---

## Fasilitas

GOR menyediakan:

* Locker
* Kamar Mandi

Fasilitas hanya bersifat informasi dan tidak dapat dipesan secara terpisah.

---

# 6. Jam Operasional

Jam operasional:

08:00 - 22:00

Slot booking menggunakan interval 1 jam.

---

# 7. Business Rules

## Rule 1

Hanya terdapat satu lapangan.

---

## Rule 2

Dalam satu slot waktu hanya boleh terdapat satu booking.

---

## Rule 3

Jenis olahraga tidak mempengaruhi ketersediaan lapangan.

---

## Rule 4

Booking yang bertabrakan harus otomatis ditolak.

---

## Rule 5

Customer wajib login sebelum melakukan booking.

---

## Rule 6

Admin dapat mengelola seluruh booking.

---

## Rule 7

Customer hanya dapat melihat riwayat booking miliknya sendiri.

---

# 8. User Flow

## Customer

Register

↓

Login

↓

Dashboard

↓

Lihat Jadwal

↓

Pilih Tanggal

↓

Pilih Jam

↓

Pilih Durasi

↓

Pilih Jenis Olahraga

↓

Konfirmasi Booking

↓

Booking Berhasil

↓

Riwayat Booking

---

## Administrator

Login

↓

Dashboard

↓

Daftar Booking

↓

Approve / Cancel Booking

↓

Logout

---

# 9. Functional Requirements

## Authentication

Customer dapat:

* Register
* Login
* Logout

Field registrasi:

* Nama
* Email
* Nomor HP
* Password

Password harus disimpan dalam bentuk hash menggunakan bcrypt.

---

## Dashboard Customer

Menampilkan:

* Booking berikutnya
* Riwayat booking
* Total booking
* Jadwal hari ini

---

## Dashboard Admin

Menampilkan:

* Total User
* Total Booking
* Booking Hari Ini
* Booking Minggu Ini
* Booking Bulan Ini

---

## Jadwal Booking

Customer dapat melihat seluruh jadwal penggunaan lapangan.

Slot:

Hijau → Tersedia

Merah → Sudah Dibooking

---

## Booking Lapangan

Customer memilih:

* Tanggal
* Jam Mulai
* Durasi
* Jenis Olahraga

Sistem otomatis menghitung:

Jam Selesai

Kemudian melakukan pengecekan bentrok jadwal.

Jika terdapat overlap maka booking ditolak.

---

## Riwayat Booking

Menampilkan:

* Tanggal
* Jam
* Durasi
* Jenis Olahraga
* Status Booking

---

## Profil

Customer dapat:

* Mengubah nama
* Mengubah nomor HP
* Mengubah password

---

# 10. Status Booking

Booking memiliki status:

* Pending
* Approved
* Cancelled
* Completed

---

# 11. Database (High Level)

## Users

* id
* nama
* email
* password
* nomor_hp
* role
* created_at
* updated_at

---

## Bookings

* id
* user_id
* sport
* booking_date
* start_time
* end_time
* duration
* status
* created_at
* updated_at

---

# 12. Validasi Booking

Sistem wajib melakukan pengecekan terhadap seluruh booking yang memiliki tanggal yang sama.

Booking dinyatakan bentrok apabila:

Booking Lama:

start_time < end_time_booking_baru

DAN

end_time > start_time_booking_baru

Jika kondisi tersebut terpenuhi maka booking baru harus ditolak.

---

# 13. Technology Stack

## Frontend

* HTML5
* CSS3
* Vanilla JavaScript (ES6)
* Responsive Design
* Font Awesome

---

## Backend

* Node.js
* Express.js
* REST API

Menggunakan arsitektur MVC:

* Models
* Views
* Controllers

---

## Database

* MySQL 8

Database diakses menggunakan library:

mysql2

---

## Authentication

* JWT
* bcrypt

---

## Development Environment

Seluruh aplikasi dijalankan menggunakan Docker.

Container yang digunakan:

* Node.js Application
* MySQL Database

Konfigurasi menggunakan Docker Compose.

Developer cukup menjalankan:

docker compose up --build

untuk menjalankan seluruh aplikasi.

---

# 14. Non Functional Requirements

Aplikasi harus:

* Responsive pada desktop, tablet, dan mobile.
* Memiliki struktur folder yang rapi dan modular.
* Menggunakan environment variable (.env).
* Menggunakan validasi pada sisi frontend dan backend.
* Menghasilkan REST API yang konsisten.
* Mudah dikembangkan menjadi sistem multi-GOR dan multi-lapangan di masa mendatang.

---

# 16. Deliverables

Developer diharapkan menghasilkan:

* Source code frontend.
* Source code backend.
* REST API.
* Struktur database MySQL.
* Dockerfile.
* docker-compose.yml.
* File .env.example.
* Dokumentasi instalasi pada README.md.
* Dokumentasi API.
* ERD (Entity Relationship Diagram).
