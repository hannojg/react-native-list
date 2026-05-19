import UIKit

final class HostCell: UICollectionViewCell {

    static let verticalInset: CGFloat = 8
    static let horizontalInset: CGFloat = 16

    private var hostedView: UIView?
    private var widthConstraint: NSLayoutConstraint?
    private var heightConstraint: NSLayoutConstraint?

    var reactTag: Int?
    var itemKey: String?
    var hasHostedView: Bool {
        return hostedView != nil
    }

    func install(view: UIView, contentSize: CGSize, itemKey: String) {
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

        view.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(view)

        let widthConstraint = view.widthAnchor.constraint(equalToConstant: contentSize.width)
        let heightConstraint = view.heightAnchor.constraint(equalToConstant: contentSize.height)
        self.widthConstraint = widthConstraint
        self.heightConstraint = heightConstraint

        NSLayoutConstraint.activate([
            view.topAnchor.constraint(equalTo: contentView.topAnchor, constant: Self.verticalInset),
            view.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: Self.horizontalInset),
            widthConstraint,
            heightConstraint,
        ])
    }

    func updateContentSize(_ contentSize: CGSize) {
        widthConstraint?.constant = contentSize.width
        heightConstraint?.constant = contentSize.height
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
        reactTag = nil
        itemKey = nil
        widthConstraint = nil
        heightConstraint = nil
    }

    override func prepareForReuse() {
        super.prepareForReuse()
        if let hostedView {
            contentView.bringSubviewToFront(hostedView)
        }
    }

    func isHosting(_ view: UIView) -> Bool {
        return hostedView === view
    }

    func releaseHostedViewReferenceIfNeeded(for view: UIView) {
        guard hostedView === view else { return }

        hostedView = nil
        reactTag = nil
        itemKey = nil
        widthConstraint = nil
        heightConstraint = nil
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
}
