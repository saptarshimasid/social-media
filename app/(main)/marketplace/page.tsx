"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, Plus, X, Upload, Phone, DollarSign, Tag,
  Car, Home as HomeIcon, Shirt, Laptop, Package,
  ShoppingCart, ChevronDown, Check, PartyPopper
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createClient } from "@/lib/supabase";
import UserAvatar from "@/components/user-avatar";
import LoadingSpinner from "@/components/loading-spinner";
import EmptyState from "@/components/empty-state";

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  owner_phone: string | null;
  owner_id: string;
  created_at: string;
  profiles?: {
    full_name: string;
    username: string;
    profile_picture_url: string | null;
  };
}

const CATEGORIES = [
  { key: "all", label: "All", icon: Package },
  { key: "cars", label: "Cars", icon: Car },
  { key: "flats", label: "Flats", icon: HomeIcon },
  { key: "clothing", label: "Clothing", icon: Shirt },
  { key: "electronics", label: "Electronics", icon: Laptop },
  { key: "others", label: "Others", icon: Tag },
];

export default function MarketplacePage() {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [showBuySuccess, setShowBuySuccess] = useState(false);
  const [buyProduct, setBuyProduct] = useState<Product | null>(null);

  // Create form
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState("others");
  const [newPhone, setNewPhone] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const supabase = createClient();

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from("marketplace_products")
        .select("*, profiles(full_name, username, profile_picture_url)")
        .order("created_at", { ascending: false });

      if (category !== "all") {
        query = query.eq("category", category);
      }

      const { data, error } = await query;
      if (error) throw error;
      setProducts((data as unknown as Product[]) || []);
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  }, [user, category, supabase]);

  useEffect(() => {
    const timer = setTimeout(() => fetchProducts(), 0);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim() || !newPrice || !imageFile) return;
    setCreating(true);

    try {
      const ext = imageFile.name.split(".").pop();
      const path = `${user.id}/product-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("posts").upload(path, imageFile);
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("posts").getPublicUrl(path);

      const { error: insertErr } = await supabase.from("marketplace_products").insert({
        title: newTitle.trim(),
        description: newDesc.trim(),
        price: parseFloat(newPrice),
        category: newCategory,
        image_url: urlData.publicUrl,
        owner_phone: newPhone.trim() || null,
        owner_id: user.id,
      });

      if (insertErr) throw insertErr;

      // Reset
      setNewTitle("");
      setNewDesc("");
      setNewPrice("");
      setNewCategory("others");
      setNewPhone("");
      setImageFile(null);
      setImagePreview(null);
      setShowCreate(false);
      fetchProducts();
    } catch (err) {
      console.error("Failed to create product:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleBuy = (product: Product) => {
    setBuyProduct(product);
    setShowBuySuccess(true);
    setShowDetail(null);
  };

  const filtered = products.filter(
    (p) =>
      !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingCart size={22} className="text-primary" />
            Marketplace
          </h1>
          <p className="text-xs text-muted mt-0.5">Buy and sell within your community</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-2xl hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Sell Item</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-10 rounded-2xl bg-secondary pl-10 pr-4 text-sm text-foreground placeholder-muted border border-transparent focus:border-primary/40 focus:bg-background transition-all focus:outline-none"
        />
      </div>

      {/* Category filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = category === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted hover:text-foreground hover:bg-secondary/80"
              }`}
            >
              <Icon size={14} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size={32} />
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3">
          {filtered.map((product) => (
            <div
              key={product.id}
              onClick={() => setShowDetail(product)}
              className="bg-card border border-border/40 rounded-3xl overflow-hidden shadow-sm glass hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
            >
              <div className="aspect-square relative overflow-hidden bg-secondary/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image_url}
                  alt={product.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2 right-2">
                  <span className="px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-semibold backdrop-blur-sm">
                    {CATEGORIES.find((c) => c.key === product.category)?.label || product.category}
                  </span>
                </div>
              </div>
              <div className="p-3">
                <h3 className="text-sm font-semibold text-foreground truncate">{product.title}</h3>
                <p className="text-xs text-muted line-clamp-1 mt-0.5">{product.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-primary">
                    ₹{product.price.toLocaleString()}
                  </span>
                  {product.profiles && (
                    <div className="flex items-center gap-1.5">
                      <UserAvatar
                        src={product.profiles.profile_picture_url}
                        name={product.profiles.full_name}
                        size={18}
                      />
                      <span className="text-[10px] text-muted font-medium truncate max-w-16">
                        {product.profiles.full_name.split(" ")[0]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={ShoppingCart}
          title="No Products Found"
          description="List an item for sale or try a different search."
        />
      )}

      {/* Product Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setShowDetail(null)} />
          <div className="w-full max-w-lg rounded-3xl bg-card border border-border/40 shadow-2xl relative z-10 glass animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Image */}
            <div className="aspect-video relative overflow-hidden rounded-t-3xl bg-secondary/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={showDetail.image_url}
                alt={showDetail.title}
                className="w-full h-full object-contain bg-black/5"
              />
              <button
                onClick={() => setShowDetail(null)}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
              <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-semibold backdrop-blur-sm">
                {CATEGORIES.find((c) => c.key === showDetail.category)?.label || showDetail.category}
              </span>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">{showDetail.title}</h2>
                <p className="text-2xl font-bold text-primary mt-1">
                  ₹{showDetail.price.toLocaleString()}
                </p>
              </div>

              <p className="text-sm text-foreground/80 leading-relaxed">{showDetail.description}</p>

              {/* Seller info */}
              {showDetail.profiles && (
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/50">
                  <UserAvatar
                    src={showDetail.profiles.profile_picture_url}
                    name={showDetail.profiles.full_name}
                    size={40}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{showDetail.profiles.full_name}</p>
                    <p className="text-[10px] text-muted">@{showDetail.profiles.username}</p>
                  </div>
                </div>
              )}

              {/* Phone */}
              {showDetail.owner_phone && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                  <Phone size={16} className="text-emerald-600" />
                  <div>
                    <p className="text-[10px] text-muted font-medium">Seller Contact</p>
                    <p className="text-sm font-semibold text-foreground">{showDetail.owner_phone}</p>
                  </div>
                </div>
              )}

              {/* Buy button */}
              {showDetail.owner_id !== user?.id && (
                <button
                  onClick={() => handleBuy(showDetail)}
                  className="w-full h-12 bg-primary text-primary-foreground font-semibold rounded-2xl hover:bg-primary/95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={18} />
                  Buy Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Buy Success Modal */}
      {showBuySuccess && buyProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => setShowBuySuccess(false)} />
          <div className="w-full max-w-sm rounded-3xl bg-card border border-border/40 shadow-2xl p-6 relative z-10 glass animate-in zoom-in-95 duration-150 text-center">
            <div className="text-6xl mb-4 animate-bounce">🎉</div>
            <h2 className="text-xl font-bold text-foreground mb-2">Purchase Interest Sent!</h2>
            <p className="text-sm text-muted mb-4">
              Contact the seller to complete your purchase of{" "}
              <span className="font-semibold text-foreground">{buyProduct.title}</span>
            </p>

            {buyProduct.owner_phone && (
              <div className="mb-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-[10px] text-muted font-medium mb-1">Seller Phone</p>
                <p className="text-lg font-bold text-emerald-600">{buyProduct.owner_phone}</p>
              </div>
            )}

            {buyProduct.profiles && (
              <div className="mb-4 p-3 rounded-2xl bg-secondary/50">
                <p className="text-[10px] text-muted font-medium mb-1">Seller Profile</p>
                <p className="text-sm font-semibold text-foreground">
                  {buyProduct.profiles.full_name} (@{buyProduct.profiles.username})
                </p>
              </div>
            )}

            <button
              onClick={() => {
                setShowBuySuccess(false);
                setBuyProduct(null);
              }}
              className="w-full h-10 bg-primary text-primary-foreground font-semibold rounded-2xl hover:bg-primary/95 transition-all cursor-pointer text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Create Product Listing Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="absolute inset-0" onClick={() => !creating && setShowCreate(false)} />
          <div className="w-full max-w-md rounded-3xl bg-card border border-border/40 shadow-2xl p-6 relative z-10 glass animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border/40 mb-4">
              <h2 className="text-lg font-bold text-foreground">List an Item</h2>
              <button
                onClick={() => setShowCreate(false)}
                disabled={creating}
                className="p-1.5 rounded-full hover:bg-secondary text-muted transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Image */}
              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Product Image *</label>
                <div
                  className="aspect-video rounded-2xl border-2 border-dashed border-border/40 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/40 transition-colors relative"
                  onClick={() => document.getElementById("product-image-input")?.click()}
                >
                  {imagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imagePreview} alt="Product" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted">
                      <Upload size={24} />
                      <span className="text-xs font-medium">Click to upload product image</span>
                    </div>
                  )}
                  <input
                    id="product-image-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setImageFile(f);
                        setImagePreview(URL.createObjectURL(f));
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. iPhone 15 Pro Max"
                  required
                  className="w-full h-10 rounded-2xl bg-secondary px-4 text-sm text-foreground placeholder-muted border border-transparent focus:border-primary/40 focus:bg-background transition-all focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Price (₹) *</label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="0"
                    required
                    min="0"
                    step="1"
                    className="w-full h-10 rounded-2xl bg-secondary px-4 text-sm text-foreground placeholder-muted border border-transparent focus:border-primary/40 focus:bg-background transition-all focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted mb-1 block">Category *</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full h-10 rounded-2xl bg-secondary px-4 text-sm text-foreground border border-transparent focus:border-primary/40 focus:bg-background transition-all focus:outline-none"
                  >
                    {CATEGORIES.filter((c) => c.key !== "all").map((cat) => (
                      <option key={cat.key} value={cat.key}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Description *</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Describe your product..."
                  rows={3}
                  required
                  className="w-full rounded-2xl bg-secondary px-4 py-3 text-sm text-foreground placeholder-muted border border-transparent focus:border-primary/40 focus:bg-background transition-all focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted mb-1 block">Phone Number (Optional)</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full h-10 rounded-2xl bg-secondary px-4 text-sm text-foreground placeholder-muted border border-transparent focus:border-primary/40 focus:bg-background transition-all focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={creating || !newTitle.trim() || !newPrice || !imageFile}
                className="w-full h-12 bg-primary text-primary-foreground font-semibold rounded-2xl hover:bg-primary/95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <LoadingSpinner size={18} />
                    <span>Listing...</span>
                  </>
                ) : (
                  <span>List Item</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
