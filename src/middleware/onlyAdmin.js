export const ifAdmin = (req, res, next) => {
    if (req.user?.role === "admin") {
        return next();
    }
    res.status(403).json({ message: "Forbidden: Admins only" });
}