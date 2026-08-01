"use client";

import { useState } from "react";

import { CategoryCard } from "@/components/home/category-card";
import { SubcategorySelector } from "@/components/home/subcategory-selector";
import type { HomeCategory } from "@/mocks/home";

export function CategorySelector({ categories }: { categories: readonly HomeCategory[] }) {
  const [selectedCategory, setSelectedCategory] = useState(categories[0]?.name);
  const active = categories.find((category) => category.name === selectedCategory) ?? categories[0];
  if (!active) return null;
  return <div className="space-y-6"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{categories.map((category) => <CategoryCard key={category.name} category={category} active={category.name === active.name} onSelect={() => setSelectedCategory(category.name)} />)}</div><SubcategorySelector category={active.name} items={active.subcategories} /></div>;
}
