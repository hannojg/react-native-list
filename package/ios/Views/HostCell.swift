import UIKit

final class HostCell: UICollectionViewCell {

    private var hostedView: UIView?
    private var topConstraint: NSLayoutConstraint?
    private var leadingConstraint: NSLayoutConstraint?
    private var widthConstraint: NSLayoutConstraint?
    private var heightConstraint: NSLayoutConstraint?

    var reactTag: Int?
    var itemKey: String?
    var itemType: String?
    var renderedContentView: UIView?
    var releaseSurface: (() -> Void)?
    var hostedContentView: UIView? {
        return hostedView
    }

    deinit {
        releaseSurface?()
    }

    func install(
        view: UIView,
        contentSize: CGSize,
        contentInset: UIEdgeInsets,
        itemKey: String,
        itemType: String
    ) {
        if let currentHostedView = hostedView {
            let isCurrentViewOwnedByCell = currentHostedView.superview === contentView
            if isCurrentViewOwnedByCell {
                deactivateInstalledConstraints(for: currentHostedView)
                currentHostedView.removeFromSuperview()
            }
        }

        deactivateInstalledConstraints(for: view)
        view.removeFromSuperview()

        hostedView = view
        self.itemKey = itemKey
        self.itemType = itemType

        view.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(view)

        let widthConstraint = view.widthAnchor.constraint(equalToConstant: contentSize.width)
        let heightConstraint = view.heightAnchor.constraint(equalToConstant: contentSize.height)
        let topConstraint = view.topAnchor.constraint(
            equalTo: contentView.topAnchor,
            constant: contentInset.top
        )
        let leadingConstraint = view.leadingAnchor.constraint(
            equalTo: contentView.leadingAnchor,
            constant: contentInset.left
        )
        self.topConstraint = topConstraint
        self.leadingConstraint = leadingConstraint
        self.widthConstraint = widthConstraint
        self.heightConstraint = heightConstraint

        NSLayoutConstraint.activate([
            topConstraint,
            leadingConstraint,
            widthConstraint,
            heightConstraint,
        ])
    }

    func bind(itemKey: String) {
        self.itemKey = itemKey
    }

    func prepareForMeasurement(width: CGFloat, height: CGFloat?) {
        // Text-like rows need a concrete width to wrap before we can measure natural height.
        setWidthConstraint(width)

        if let height {
            setHeightConstraint(height)
        } else {
            deactivateHeightConstraint()
        }
    }

    func updateContentLayout(contentSize: CGSize, contentInset: UIEdgeInsets) {
        setTopConstraint(contentInset.top)
        setLeadingConstraint(contentInset.left)
        setWidthConstraint(contentSize.width)
        setHeightConstraint(contentSize.height)
    }

    func detachHostedView() {
        if let hostedView {
            let isHostedViewOwnedByCell = hostedView.superview === contentView
            if isHostedViewOwnedByCell {
                deactivateInstalledConstraints(for: hostedView)
                hostedView.removeFromSuperview()
            }
        }

        hostedView = nil
        renderedContentView = nil
        reactTag = nil
        itemKey = nil
        itemType = nil
        topConstraint = nil
        leadingConstraint = nil
        widthConstraint = nil
        heightConstraint = nil
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        itemKey = nil
        if let hostedView {
            contentView.bringSubviewToFront(hostedView)
        }
    }

    private func deactivateInstalledConstraints(for view: UIView) {
        let localConstraints = view.constraints.filter { constraint in
            let isWidthConstraint = constraint.firstAttribute == .width
            let isHeightConstraint = constraint.firstAttribute == .height
            let isSizeConstraint = isWidthConstraint || isHeightConstraint
            let firstView = constraint.firstItem as? UIView
            let isOwnedByView = firstView === view
            let isLocalConstraint = constraint.secondItem == nil
            return isSizeConstraint && isOwnedByView && isLocalConstraint
        }
        NSLayoutConstraint.deactivate(localConstraints)

        guard let superview = view.superview else { return }

        let parentConstraints = superview.constraints.filter { constraint in
            let firstView = constraint.firstItem as? UIView
            let secondView = constraint.secondItem as? UIView
            let usesFirstView = firstView === view
            let usesSecondView = secondView === view
            return usesFirstView || usesSecondView
        }
        NSLayoutConstraint.deactivate(parentConstraints)
    }

    private func setWidthConstraint(_ width: CGFloat) {
        if let widthConstraint {
            widthConstraint.constant = width
            if !widthConstraint.isActive {
                widthConstraint.isActive = true
            }
            return
        }

        guard let hostedView else { return }
        let widthConstraint = hostedView.widthAnchor.constraint(equalToConstant: width)
        self.widthConstraint = widthConstraint
        widthConstraint.isActive = true
    }

    private func setTopConstraint(_ topInset: CGFloat) {
        if let topConstraint {
            topConstraint.constant = topInset
            if !topConstraint.isActive {
                topConstraint.isActive = true
            }
            return
        }

        guard let hostedView else { return }
        let topConstraint = hostedView.topAnchor.constraint(
            equalTo: contentView.topAnchor,
            constant: topInset
        )
        self.topConstraint = topConstraint
        topConstraint.isActive = true
    }

    private func setLeadingConstraint(_ leadingInset: CGFloat) {
        if let leadingConstraint {
            leadingConstraint.constant = leadingInset
            if !leadingConstraint.isActive {
                leadingConstraint.isActive = true
            }
            return
        }

        guard let hostedView else { return }
        let leadingConstraint = hostedView.leadingAnchor.constraint(
            equalTo: contentView.leadingAnchor,
            constant: leadingInset
        )
        self.leadingConstraint = leadingConstraint
        leadingConstraint.isActive = true
    }

    private func setHeightConstraint(_ height: CGFloat) {
        if let heightConstraint {
            heightConstraint.constant = height
            if !heightConstraint.isActive {
                heightConstraint.isActive = true
            }
            return
        }

        guard let hostedView else { return }
        let heightConstraint = hostedView.heightAnchor.constraint(equalToConstant: height)
        self.heightConstraint = heightConstraint
        heightConstraint.isActive = true
    }

    private func deactivateWidthConstraint() {
        guard let widthConstraint else { return }
        widthConstraint.isActive = false
        self.widthConstraint = nil
    }

    private func deactivateHeightConstraint() {
        guard let heightConstraint else { return }
        heightConstraint.isActive = false
        self.heightConstraint = nil
    }
}
