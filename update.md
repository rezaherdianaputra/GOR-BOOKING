# UPDATE v1.1
## GOR Booking Management System

Version : 1.1

---

# Overview

Dokumen ini merupakan pembaruan dari PRD versi 1.0.

Seluruh perubahan pada dokumen ini menjadi acuan implementasi terbaru dan menggantikan requirement lama apabila terjadi konflik.

---

# Feature 1 - Public Schedule

## Objective

Pengunjung dapat melihat ketersediaan jadwal lapangan tanpa harus login.

## Requirement

Tambahkan menu baru pada Landing Page:

- Cek Jadwal

Fitur dapat digunakan oleh seluruh pengunjung.

Pengunjung dapat memilih:

- Tanggal

Kemudian sistem menampilkan seluruh slot jam operasional.

Status slot:

- Available
- Reserved
- Booked

Pengunjung dapat melihat jadwal tanpa harus login.

Untuk melakukan booking tetap wajib login.

---

# Feature 2 - New Booking Flow

Booking Flow diperbarui menjadi:

Customer

↓

Pilih Jadwal

↓

Booking

↓

WAITING_PAYMENT

↓

Slot Reserved

↓

Countdown 10 Menit

↓

Transfer Bank

↓

Upload Bukti Transfer

↓

WAITING_VERIFICATION

↓

Admin Verifikasi

↓

CONFIRMED

↓

Customer Datang

↓

COMPLETED

---

# Feature 3 - Payment Method

Untuk MVP hanya tersedia satu metode pembayaran.

Transfer Bank.

Contoh rekening:

Bank BCA

1234567890

a.n. GOR PJT II

Nomor rekening harus dapat diubah melalui halaman Pengaturan Admin.

---

# Feature 4 - Payment Countdown

Setelah booking dibuat.

Sistem otomatis memberikan waktu pembayaran:

10 Menit

Selama countdown berjalan.

Status Booking:

WAITING_PAYMENT

Slot:

RESERVED

Apabila waktu habis.

Booking menjadi:

EXPIRED

Payment menjadi:

EXPIRED

Slot kembali:

AVAILABLE

---

# Feature 5 - Upload Proof of Payment

Customer wajib mengunggah bukti transfer.

Format:

- JPG
- JPEG
- PNG

Maksimum:

5 MB

Status pembayaran berubah menjadi:

WAITING_VERIFICATION

---

# Feature 6 - Admin Payment Verification

Tambahkan halaman baru:

Payment Verification

Admin dapat:

- Melihat daftar pembayaran
- Melihat bukti transfer
- Approve pembayaran
- Reject pembayaran

Jika Approve:

Booking

↓

CONFIRMED

Jika Reject:

Booking

↓

WAITING_PAYMENT

Apabila countdown telah habis.

↓

EXPIRED

---

# Feature 7 - User Notification

Tambahkan Notification Center pada Dashboard User.

Notifikasi muncul ketika:

- Booking dibuat
- Bukti pembayaran berhasil diunggah
- Pembayaran disetujui
- Pembayaran ditolak
- Booking kedaluwarsa

---

# Feature 8 - Email Notification

Gunakan Nodemailer.

Sistem mengirim email otomatis ketika:

Booking berhasil dibuat.

Pembayaran diterima.

Booking dikonfirmasi.

Booking ditolak.

Booking kedaluwarsa.

Isi email minimal:

- Booking ID
- Nama Customer
- Jenis Olahraga
- Tanggal
- Jam
- Durasi
- Total Pembayaran
- Status Booking

---

# Feature 9 - Dashboard User

Dashboard User diperbarui.

Menu:

- Booking Aktif
- Riwayat Booking
- Riwayat Pembayaran
- Countdown Pembayaran
- Upload Bukti Transfer
- Notification Center
- Profil

---

# Feature 10 - Dashboard Admin

Tambahkan menu baru:

Payment Verification

Admin dapat:

- Melihat pembayaran masuk
- Melihat bukti transfer
- Approve
- Reject

---

# Database Changes

Tambahkan tabel baru:

payments

notifications

settings

Relasi:

Users

↓

Bookings

↓

Payments

Bookings

↓

Notifications

Settings digunakan untuk:

- Harga per jam
- Jam operasional
- Rekening Bank
- Nama GOR
- Nomor WhatsApp

---

# Booking Status

Status Booking menjadi:

- WAITING_PAYMENT
- WAITING_VERIFICATION
- CONFIRMED
- COMPLETED
- CANCELLED
- EXPIRED

Booking dengan status berikut memblokir slot:

- WAITING_PAYMENT
- WAITING_VERIFICATION
- CONFIRMED

Booking dengan status berikut tidak memblokir slot:

- CANCELLED
- COMPLETED
- EXPIRED

---

# Payment Status

Status Payment:

- PENDING
- WAITING_VERIFICATION
- PAID
- REJECTED
- EXPIRED

---

# Impact Analysis

Perbarui dokumen berikut:

- PRD

Perbarui implementasi:

- Landing Page
- Dashboard User
- Dashboard Admin
- Booking Module
- Payment Module
- Notification Module
- Email Service

---

# Instructions for AI Agent

Sebelum mengubah kode:

1. Analisis perubahan berdasarkan dokumen ini.
2. Jelaskan file yang akan ditambah atau diubah.
3. Setelah analisis selesai, baru lakukan implementasi.

---

# UPDATE v1.2
## OTP & Captcha Verification

Version : 1.2

---

# Overview

Pembaruan ini menambahkan mekanisme keamanan login berupa Verifikasi Captcha pada saat login dan One-Time Password (OTP) via Email pada saat registrasi untuk mencegah pendaftaran/masuk otomatis oleh botting serta memastikan keaslian alamat email pengguna.

---

# Feature 11 - Login Captcha Verification

## Objective
Mencegah login otomatis oleh bot/skrip dengan mewajibkan verifikasi kode gambar (Captcha) saat proses login.

## Requirement
1. Sistem menampilkan gambar Captcha berupa SVG inline dinamis berisi 5 karakter acak yang dikaburkan dengan garis (*noise lines*) dan titik (*noise dots*).
2. Endpoint Captcha disediakan pada `GET /api/auth/captcha` yang mengembalikan kode ID Captcha dan data SVG.
3. User harus menginput teks captcha dengan benar saat melakukan login.
4. Validasi captcha bersifat *case-insensitive*.
5. Apabila input Captcha salah, server langsung menolak proses login dan meminta pengguna memasukkan captcha baru (captcha disegarkan secara otomatis).
6. Captcha kedaluwarsa setelah 5 menit dan dihapus secara berkala oleh sistem.

---

# Feature 12 - Email Verification via OTP on Register

## Objective
Memverifikasi alamat email pengguna yang mendaftar (Registrasi) dengan mengirimkan kode OTP (One-Time Password) ke email mereka sebelum akun resmi dibuat/diaktifkan di database.

## Requirement
1. Ketika pengguna mengisi formulir registrasi dan mengklik "Daftar", sistem memvalidasi kelayakan data (misal: email belum terdaftar).
2. Sistem menghasilkan kode OTP acak 6-digit angka, lalu menyimpan data registrasi sementara dan kode OTP tersebut ke tabel `temp_registrations` dengan batas kedaluwarsa 5 menit.
3. Sistem mengirimkan kode OTP ke email pendaftar.
4. Tampilan registrasi (frontend) akan bertransisi ke layar input OTP registrasi.
5. Tombol "Kirim Ulang OTP" disediakan dengan countdown timer selama 60 detik.
6. User memasukkan kode OTP ke form registrasi dan mengirimkan data ke endpoint `POST /api/auth/verify-register-otp`.
7. Jika verifikasi OTP berhasil:
   - Sistem memindahkan data dari tabel `temp_registrations` ke tabel `users`.
   - Mengembalikan respon sukses dan mengarahkan pengguna ke halaman login.
8. Data registrasi sementara yang kedaluwarsa dihapus secara berkala oleh sistem.

---

# Database Changes

Tambahkan tabel baru:
- `captchas` (id, answer, expires_at)
- `temp_registrations` (id, nama, email, password, nomor_hp, otp, expires_at, created_at)

---

# Instructions for AI Agent

Sebelum mengubah kode:
1. Pastikan Rencana Implementasi disetujui.
2. Lakukan pengujian dan pastikan fitur berjalan dengan lancar baik untuk mode fallback (mock email) maupun SMTP riil.

---

# UPDATE v1.3
## Custom Booking ID Format (BK-YYMMDD-XXXX)

Version : 1.3

---

# Overview

Pembaruan ini mengubah format Booking ID dari angka berurutan sederhana (`INT AUTO_INCREMENT`) menjadi kode alphanumeric unik dengan format khusus (`BK-YYMMDD-XXXX`) untuk meningkatkan keamanan, skalabilitas, dan kemudahan pelacakan pesanan.

---

# Feature 13 - Alphanumeric Booking ID Generation

## Objective
Menghasilkan kode unik untuk setiap pesanan lapangan yang aman dari tebakan berurutan dan mengidentifikasi tanggal pemesanan secara langsung.

## Requirement
1. Prefiks yang digunakan harus `BK`.
2. Setelah prefiks, ikuti dengan tanggal pembuatan pesanan dalam format `YYMMDD` (contoh: `260710` untuk 10 Juli 2026).
3. Setelah tanggal, tambahkan tanda hubung `-` dan 4 karakter alphanumeric acak (menggunakan huruf kapital `A-Z` dan angka `2-9`, mengecualikan karakter membingungkan seperti `0, O, o, 1, l, I`).
4. Format final: `BK-YYMMDD-XXXX` (contoh: `BK-260710-J9F2`).
5. Kode harus diverifikasi keunikannya terhadap basis data (`bookings.id`) sebelum disimpan untuk menghindari duplikasi (*collision*).

---

# Database Changes

- Mengubah tipe kolom kunci utama `bookings.id` dari `INT AUTO_INCREMENT` menjadi `VARCHAR(50)`.
- Menyesuaikan tipe kolom relasi asing `payments.booking_id` dan `notifications.booking_id` menjadi `VARCHAR(50)`.
