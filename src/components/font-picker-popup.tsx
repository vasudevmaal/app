"use client";

import { useEffect, useRef, useState } from "react";
import { LockKeyhole, Search, Star, Type, Upload, X } from "lucide-react";
import type { FontAssetSummary } from "@/lib/font-library";
import { api } from "@/lib/client";
import { useApp } from "@/components/providers";
import css from "@/components/button/editor.module.css";

export function FontPickerPopup({
  fontName,
  options,
  previewText,
  libraryFonts = [],
  onSelect,
  onUpload,
}: {
  fontName: string;
  options: string[];
  previewText: string;
  libraryFonts?: FontAssetSummary[];
  onSelect: (font: string) => void;
  onUpload: () => void;
}) {
  const { user, toast } = useApp();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const dismissOutside = (event: PointerEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    return () =>
      document.removeEventListener("pointerdown", dismissOutside, true);
  }, [pickerOpen]);

  function openPicker() {
    if (dialogRef.current?.open) return;
    setLoginRequired(false);
    setShowFavorites(false);
    setSearch("");
    dialogRef.current?.showModal();
    setPickerOpen(true);
    setLoading(true);
    if (user) {
      void api<string[]>("font-favorites")
        .then(setFavorites)
        .catch((error) => toast((error as Error).message, true));
    } else {
      setFavorites([]);
    }
    void Promise.all(
      options.map(async (family) => {
        try {
          const asset = libraryFonts.find((font) => font.name === family);
          if (!asset) {
            await document.fonts.load(`700 24px "${family}"`);
            return;
          }
          const response = await fetch(
            `/api/font-library?id=${encodeURIComponent(asset.id)}`,
          );
          if (!response.ok) return;
          const face = await new FontFace(
            family,
            await response.arrayBuffer(),
          ).load();
          document.fonts.add(face);
        } catch {}
      }),
    ).finally(() => setLoading(false));
  }

  async function toggleFavorite(font: string) {
    if (!user) {
      setLoginRequired(true);
      return;
    }
    const exists = favorites.includes(font);
    try {
      await api(
        "font-favorites",
        { font_name: font },
        exists ? "DELETE" : "POST",
      );
      setFavorites((current) =>
        exists
          ? current.filter((item) => item !== font)
          : current.includes(font)
            ? current
            : [...current, font],
      );
      toast(exists ? "Removed from favorite fonts." : "Font saved to favorites.");
    } catch (error) {
      toast((error as Error).message, true);
    }
  }

  const filteredFonts = options.filter((font) => {
    return (
      (!showFavorites || favorites.includes(font)) &&
      font.toLowerCase().includes(search.trim().toLowerCase())
    );
  });

  return (
    <>
      <button
        type="button"
        className={css.fontPickerTrigger}
        onClick={() => void openPicker()}
      >
        <span>{fontName}</span>
        <Type size={16} aria-hidden="true" />
      </button>
      <dialog
        ref={dialogRef}
        className={css.fontDialog}
        aria-label="Choose a font"
        onClose={() => {
          setPickerOpen(false);
          setLoginRequired(false);
        }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const { clientX, clientY } = event;
          if (
            clientX < rect.left ||
            clientX > rect.right ||
            clientY < rect.top ||
            clientY > rect.bottom
          )
            dialogRef.current?.close();
        }}
      >
        <header className={css.fontDialogHeader}>
          <div>
            <h2>Choose a font</h2>
            <p>Preview each style with your text.</p>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close font picker"
            onClick={() => dialogRef.current?.close()}
          >
            <X size={18} />
          </button>
        </header>
        <div className={css.fontDialogActions}>
          <label className={css.fontSearch}>
            <Search size={15} />
            <input
              type="search"
              aria-label="Search fonts"
              placeholder="Search fonts"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={`button small ${showFavorites ? "selected" : ""}`}
            aria-pressed={showFavorites}
            onClick={() => {
              if (!user) {
                setLoginRequired(true);
                return;
              }
              setShowFavorites((value) => !value);
            }}
          >
            <Star size={14} fill={showFavorites ? "currentColor" : "none"} />
            Favorites
          </button>
          <button
            type="button"
            className="button small"
            onClick={onUpload}
          >
            <Upload size={14} /> Upload font
          </button>
        </div>
        {loading && (
          <p className={css.fontLoading} role="status">
            Loading font previews...
          </p>
        )}
        <div className={css.fontGrid}>
          {filteredFonts.map((font) => (
            <div
              key={font}
              className={`${css.fontCard} ${fontName === font ? css.fontCardActive : ""}`}
            >
              <button
                type="button"
                className={css.fontChoice}
                aria-label={`Use ${font} font`}
                aria-pressed={fontName === font}
                onClick={() => {
                  onSelect(font);
                  dialogRef.current?.close();
                }}
              >
                <span style={{ fontFamily: `"${font}", sans-serif` }}>
                  {previewText.slice(0, 22) || "Aa Bb 123"}
                </span>
                <small>{font}</small>
              </button>
              <button
                type="button"
                className={css.fontFavorite}
                aria-label={`${favorites.includes(font) ? "Remove" : "Add"} ${font} ${favorites.includes(font) ? "from" : "to"} favorites`}
                aria-pressed={favorites.includes(font)}
                title={favorites.includes(font) ? "Remove favorite" : "Add favorite"}
                onClick={() => void toggleFavorite(font)}
              >
                <Star
                  size={15}
                  fill={favorites.includes(font) ? "currentColor" : "none"}
                />
              </button>
            </div>
          ))}
          {filteredFonts.length === 0 && (
            <p className={css.fontEmpty}>
              {showFavorites && favorites.length === 0
                ? "No favorite fonts yet."
                : "No matching fonts."}
            </p>
          )}
        </div>
        {loginRequired && (
          <div
            className={css.loginRequiredOverlay}
            onClick={(event) => {
              if (event.target === event.currentTarget)
                setLoginRequired(false);
            }}
          >
            <section
              className={css.loginRequiredPopup}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="font-login-required-title"
              aria-describedby="font-login-required-description"
            >
              <span className={css.loginRequiredIcon}>
                <LockKeyhole size={19} />
              </span>
              <h3 id="font-login-required-title">Login required</h3>
              <p id="font-login-required-description">
                Sign in to save and access your favorite fonts.
              </p>
              <button
                type="button"
                className="button accent"
                onClick={() => setLoginRequired(false)}
              >
                Got it
              </button>
            </section>
          </div>
        )}
      </dialog>
    </>
  );
}
