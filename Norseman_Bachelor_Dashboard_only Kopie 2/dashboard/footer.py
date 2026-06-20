import streamlit as st

from core.config import APP_INFO, ASSET_PATHS, assets_last_updated_label


def footer() -> None:
    st.markdown('<div class="app-footer-divider"></div>', unsafe_allow_html=True)

    col_left, col_center, col_contact, col_ns_logo, col_hdm_logo = st.columns(
        [1.3, 2.6, 1.5, 0.8, 0.8]
    )

    with col_left:
        st.markdown(f"[Official Race Site]({APP_INFO.source_url})")

    with col_center:
        st.markdown(
            f"Data coverage: **2018-2025**  \nLast packaged asset update: **{assets_last_updated_label()}**"
        )

    with col_contact:
        st.markdown(f"[Contact](mailto:{APP_INFO.contact_email})")

    with col_ns_logo:
        if ASSET_PATHS.black_shirt_logo.exists():
            st.image(str(ASSET_PATHS.black_shirt_logo), width=68)

    with col_hdm_logo:
        if ASSET_PATHS.hdm_logo.exists():
            st.image(str(ASSET_PATHS.hdm_logo), width=68)
