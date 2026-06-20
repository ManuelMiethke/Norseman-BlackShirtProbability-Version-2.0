from core.config import ASSET_PATHS, DEFAULT_PAGE_TITLE
import streamlit as st

import data_store
from header import render_header


def apply_global_style() -> None:
    st.markdown(
        """
        <style>
        section[data-testid="stSidebar"] [data-testid="stSidebarNav"] a[href*="main"],
        section[data-testid="stSidebar"] [data-testid="stSidebarNav"] a[href*="/main"],
        section[data-testid="stSidebar"] [data-testid="stSidebarNav"] a[href*="?page=main"] {
            display: none !important;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )

    if ASSET_PATHS.styles_css.exists():
        st.markdown(
            f"<style>{ASSET_PATHS.styles_css.read_text(encoding='utf-8')}</style>",
            unsafe_allow_html=True,
        )


def setup_page(page_title: str = DEFAULT_PAGE_TITLE):
    page_icon = str(ASSET_PATHS.black_shirt_logo) if ASSET_PATHS.black_shirt_logo.exists() else None
    st.set_page_config(page_title=page_title, page_icon=page_icon, layout="wide")
    apply_global_style()

    df_long = data_store.df_long()
    selected_year, selected_group = render_header(
        year_options=data_store.available_year_options(df_long)
    )

    return df_long, selected_year, selected_group
